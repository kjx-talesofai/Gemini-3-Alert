
export type AudioCategory = 'SYSTEM' | 'ALLIES' | 'SOVIET' | 'SFX';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext;
  private masterGain: GainNode;
  private synth: SpeechSynthesis;
  private maleVoice: SpeechSynthesisVoice | null = null;
  private systemVoice: SpeechSynthesisVoice | null = null;
  
  // Track if the current speech is a unit voice (low priority)
  private isUnitSpeaking: boolean = false;

  // Phrases configuration (English for authentic RA2 feel)
  private phrases = {
    SYSTEM: {
      lines: {
        'insufficient_funds': 'Insufficient funds',
        'building': 'Building',
        'construction_complete': 'Construction complete',
        'unit_ready': 'Unit ready',
        'base_under_attack': 'Our base is under attack',
        'battle_control_terminated': 'Battle control terminated',
        'new_construction_options': 'New construction options'
      }
    },
    ALLIES: {
      lines: {
        'select': ['Sir yes sir!', 'Ready for action', 'Awaiting orders', 'Commander?'],
        'move': ['Moving out!', 'On my way', 'Double time', 'Right away, sir'],
        'attack': ['Attacking!', 'Take them out!', 'Fire!', 'We will bury them!']
      }
    },
    SOVIET: {
      lines: {
        'select': ['Conscript reporting', 'Waiting orders', 'Comrade?', 'Da?'],
        'move': ['Moving', 'For the Union', 'Acknowledged', 'I go'],
        'attack': ['Attack!', 'Die!', 'For Mother Russia!', 'Melt them!']
      }
    }
  };

  private constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3; 
    this.masterGain.connect(this.ctx.destination);
    
    this.synth = window.speechSynthesis;
    
    if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
    }
    this.loadVoices();
  }

  private loadVoices() {
    const all = this.synth.getVoices();
    if (all.length === 0) return;

    // Heuristics to find suitable voices
    // System: Prefer "Google US English" (often female) or "Zira" (Windows)
    this.systemVoice = all.find(v => 
        v.name.includes('Google US English') || 
        v.name.includes('Zira') || 
        (v.name.includes('Female') && v.lang.includes('en'))
    ) || all.find(v => v.lang.includes('en-US')) || null;

    // Units: Prefer "Google UK English Male" or "David" (Windows)
    this.maleVoice = all.find(v => 
        v.name.includes('Google UK English Male') || 
        v.name.includes('David') || 
        (v.name.includes('Male') && v.lang.includes('en'))
    ) || all.find(v => v.lang.includes('en-GB')) || null;
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.systemVoice || !this.maleVoice) {
        this.loadVoices();
    }
  }

  private speak(text: string, pitch: number = 1, rate: number = 1, voice: SpeechSynthesisVoice | null = null, onEnd?: () => void) {
    // Note: we don't cancel here automatically anymore, handled by logic below
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = 1.0;
    
    if (voice) {
        utterance.voice = voice;
    } else {
        // Fallback
        const voices = this.synth.getVoices();
        const enVoice = voices.find(v => v.lang.includes('en'));
        if (enVoice) utterance.voice = enVoice;
    }

    if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd; // Ensure state resets even on error
    }

    this.synth.speak(utterance);
  }

  /**
   * Plays a system voice (EVA/Adjutant)
   * High Priority: Interrupts units.
   */
  public playSystem(key: string) {
    const text = this.phrases.SYSTEM.lines[key as keyof typeof this.phrases.SYSTEM.lines];
    if (text) {
      // If a unit is currently babbling, cut them off for important system info
      if (this.isUnitSpeaking && this.synth.speaking) {
          this.synth.cancel();
          this.isUnitSpeaking = false;
      }

      // We don't set isUnitSpeaking for system, so system messages can queue up normally
      this.speak(text, 1.0, 1.1, this.systemVoice); 
    }
  }

  /**
   * Plays a unit voice
   * Low Priority: Skipped if busy.
   */
  public playUnit(faction: 'ALLIES' | 'SOVIET', action: 'select' | 'move' | 'attack') {
    // If ANYONE is speaking (System or Unit), we skip this unit voice.
    // This prevents queue buildup and overlapping "Yes Sirs".
    if (this.synth.speaking) {
        return; 
    }

    const lines = this.phrases[faction].lines[action];
    const text = lines[Math.floor(Math.random() * lines.length)];
    
    // Soviet: Deeper, Allies: Higher/Normal
    const pitch = faction === 'SOVIET' ? 0.8 : 1.1;
    const rate = faction === 'SOVIET' ? 0.9 : 1.2;

    this.isUnitSpeaking = true;
    this.speak(text, pitch, rate, this.maleVoice, () => {
        this.isUnitSpeaking = false;
    });
  }

  public async playSfx(type: 'SHOT' | 'EXPLOSION' | 'BUILD') {
    await this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.ctx.currentTime;

    if (type === 'SHOT') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'EXPLOSION') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 0.4);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'BUILD') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }
}
