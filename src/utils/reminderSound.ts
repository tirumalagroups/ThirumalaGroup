let audioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

export const initAudioContext = () => {
  if (isAudioUnlocked) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported in this browser.');
      return;
    }
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    isAudioUnlocked = true;
    console.log('🔊 Audio Context initialized and unlocked.');
  } catch (e) {
    console.warn('Failed to initialize AudioContext:', e);
  }
};

// Setup audio unlock listeners for first user interaction
export const setupAudioUnlock = () => {
  const unlock = () => {
    initAudioContext();
    cleanup();
  };

  const cleanup = () => {
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('mousedown', unlock);
  };

  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('mousedown', unlock, { once: true });
};

export const isSoundEnabled = (): boolean => {
  return localStorage.getItem('reminderSoundEnabled') !== 'false';
};

export const setSoundEnabled = (enabled: boolean) => {
  localStorage.setItem('reminderSoundEnabled', String(enabled));
  window.dispatchEvent(new CustomEvent('reminder-sound-changed', { detail: { enabled } }));
};

export const getSoundVolume = (): 'soft' | 'normal' | 'loud' => {
  const vol = localStorage.getItem('reminderSoundVolume');
  if (vol === 'soft' || vol === 'normal' || vol === 'loud') {
    return vol;
  }
  return 'normal';
};

export const setSoundVolume = (volume: 'soft' | 'normal' | 'loud') => {
  localStorage.setItem('reminderSoundVolume', volume);
  window.dispatchEvent(new CustomEvent('reminder-sound-volume-changed', { detail: { volume } }));
};

export const playReminderSound = () => {
  if (!isSoundEnabled()) return;

  try {
    initAudioContext();
    if (!audioCtx) return;

    // In case state became suspended, try to resume
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const volumeLevel = getSoundVolume();
    let gainValue = 0.3; // Default Normal
    if (volumeLevel === 'soft') gainValue = 0.1;
    if (volumeLevel === 'loud') gainValue = 0.8;

    const now = audioCtx.currentTime;
    
    // Create gain node for overall volume decay
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(gainValue, now + 0.05); // quick attack
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2); // smooth decay
    masterGain.connect(audioCtx.destination);

    // Tone 1: Fundamental frequency (e.g. 587.33Hz - D5)
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    
    // Tone 2: Overtone chime frequency (e.g. 880.00Hz - A5)
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now);

    // Tone 3: Soft ambient backing frequency (e.g. 1174.66Hz - D6)
    const osc3 = audioCtx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1174.66, now);

    // Gain nodes for balancing the frequencies
    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0.6, now);
    
    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.4, now);

    const gain3 = audioCtx.createGain();
    gain3.gain.setValueAtTime(0.2, now);

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + 1.2);
    osc2.stop(now + 1.2);
    osc3.stop(now + 1.2);

  } catch (error) {
    console.warn('Failed to play reminder sound:', error);
  }
};
