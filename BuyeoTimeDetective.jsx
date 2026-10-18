import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  BookOpen,
  Map as MapIcon,
  MapPin,
  Lock,
  CheckCircle2,
  Lightbulb,
  Send,
  ChevronRight,
  X,
  Sparkles,
  Landmark,
  Mountain,
  Waves,
  Flower2,
  Crown,
  Feather,
  ScrollText,
  RotateCcw,
  Compass,
  KeyRound,
  AlertCircle,
  MessageCircle,
  Hourglass,
  FlaskConical,
  Zap,
  Eye,
  EyeOff,
  Info,
  Calendar,
  Award,
  Camera,
  ArrowLeft,
  Leaf,
  Sprout,
  Sun,
  Stamp,
  Volume2,
  VolumeX,
  Speech as SpeechIcon,
} from 'lucide-react';

/* =========================================================================
 * 부여 시간 탐정: 사라진 향로의 봉인
 * 1단계: 전체 구조 + 국립부여박물관 스테이지
 * 2단계: 나머지 6개 유적지 대사·퀴즈 + 엔딩 연결
 * 3단계: 향로 복원 엔딩·수료증, 정답/오답 애니메이션, 테스트 모드,
 *        유물 상식 팝업, 유적지 사진 배너(image 필드)
 * 4차 개편: 비주얼 노벨식 대화창(캐릭터 초상화·이름표), 보상 아이템 이미지
 * 5차 개편: 주인공 금동이의 정령형 → 인간형 각성 연출 (HERO_AVATAR_BEAST / HUMAN)
 *
 * 이미지 넣는 방법 (경로만 바꾸면 바로 적용)
 * - 장소 사진:     STAGES[n].image             예: 'images/museum.jpg'
 * - 캐릭터 초상화: dialogues[n].avatar         예: './images/characters/curator.png'
 * - 주인공 금동이: HERO_AVATAR_BEAST / HERO_AVATAR_HUMAN 상수
 * - 보상 아이템:   STAGES[n].rewardItem.image  예: './images/items/phoenix.png'
 * - 경로가 비어 있거나 사진을 불러오지 못하면 장소별 그라데이션 + 아이콘
 *   대체 화면이 자동으로 나오므로 레이아웃이 깨지지 않습니다.
 *
 * 스테이지 확장 방법
 * - 각 장소에 dialogues / quiz / clearDialogues 를 채우면 바로 플레이됩니다.
 * - quiz.type 은 'text'(단답형) 또는 'choice'(객관식)를 지원합니다.
 * - 진행 규칙: 모든 장소가 처음부터 열려 있어 순서와 상관없이 풀 수 있습니다.
 *   clearDialogues 의 next: '장소id' 대사는 그 장소가 아직 남아 있을 때만 나옵니다.
 *   (주소 끝에 ?test 를 붙이면 헤더에 '테스트' 토글이 생겨 정답 보기·즉시 클리어를 쓸 수 있습니다.)
 * - 나레이션: dialogues 에 { speaker: NARRATOR, text } 를 넣으면 초상화 없는 해설 상자로 나옵니다.
 * - 진행 상황은 localStorage 에 자동 저장되어 새로고침해도 '이어서 수사하기'로 계속할 수 있습니다.
 * - 효과음은 Web Audio 합성, 대사 음성은 브라우저 내장 음성(Web Speech)이라 외부 API가 필요 없습니다.
 *   인물별 목소리 높낮이는 VOICE, 말할 때 움직이는 입 위치는 MOUTH 에서 조정합니다.
 * ========================================================================= */

// 각 장소의 비주얼 테마 (아이콘·색)
const THEME = {
  museum: { icon: Landmark, tone: 'from-[#3a2a17] to-[#1b1510]', accent: '#e2b85c' },
  jeongnimsa: { icon: Compass, tone: 'from-[#2f2a24] to-[#16130f]', accent: '#d9c9a3' },
  busosanseong: { icon: Mountain, tone: 'from-[#1f2c22] to-[#111612]', accent: '#8fbf8a' },
  baengmagang: { icon: Waves, tone: 'from-[#182a33] to-[#0f161a]', accent: '#7fb7c9' },
  gungnamji: { icon: Flower2, tone: 'from-[#33202a] to-[#170f13]', accent: '#e39bb4' },
  royaltombs: { icon: Crown, tone: 'from-[#2b2533] to-[#14111a]', accent: '#b9a3e0' },
  sindongyeop: { icon: Feather, tone: 'from-[#2c2a1d] to-[#15140e]', accent: '#d8cf8a' },
};

// 주인공 금동이 아바타: 봉인이 풀려 힘을 잃은 정령(동물) 모습 → 일곱 봉인을 모두 모으면 인간 소년 탐정으로 각성
const HERO_AVATAR_BEAST = './images/characters/geumdongi_beast.png'; // 초반 마스코트/정령 형태
const HERO_AVATAR_HUMAN = './images/characters/geumdongi_human.png'; // 완전 복원 후 인간형
const HERO_FULL_HUMAN = './images/characters/geumdongi_human_full.png'; // 엔딩 변신 장면용 전신
const HERO_NAME = '금동이';
const NARRATOR = '나레이션'; // dialogues 에 speaker: NARRATOR 로 넣으면 초상화 없는 해설 상자로 나옵니다

// 테스트 모드 버튼은 주소 끝에 ?test 를 붙였을 때만 보입니다 (예: https://.../?test)
const TEST_ENABLED = (() => {
  try {
    return new URLSearchParams(window.location.search).has('test');
  } catch {
    return false;
  }
})();

// 말할 때 움직이는 입 위치: 초상화 이미지(3:4) 기준 %. x·y = 입 중심, w = 입 너비
// jaw 가 있으면 입을 덧그리지 않고 아랫입술·턱을 살짝 내려 입이 벌어지게 함 (원래 입이 크게 그려진 인물용)
const MOUTH = {
  'curator.png': { x: 49.3, y: 59.8, w: 9, jaw: { w: 22, h: 7.5, drop: 1.4 } },
  'monk.png': {
    x: 51, y: 65.3, w: 18,
    jaw: { w: 34, h: 7, drop: 1.1, curve: [[39, 63.9], [44, 64.9], [51, 65.3], [58, 64.9], [64, 63.6]] },
  },
  'gatekeeper.png': { x: 49.5, y: 57.5, w: 6 },
  'boatman.png': { x: 49.5, y: 62.3, w: 17, jaw: { w: 36, h: 11, drop: 1.3 } },
  'court_lady.png': { x: 68, y: 67, w: 7 },
  'tomb_keeper.png': { x: 51.5, y: 54, w: 8 },
  'docent.png': {
    x: 50, y: 52.7, w: 12,
    jaw: { w: 24, h: 6, drop: 1.2, curve: [[42.3, 51.9], [45.5, 52.5], [50, 52.7], [54.5, 52.5], [58.2, 51.4]] },
  },
  'geumdongi_beast.png': { x: 50, y: 71, w: 3.5 },
  'geumdongi_human.png': {
    x: 49.3, y: 60.5, w: 12,
    jaw: { w: 26, h: 5.5, drop: 1.3, curve: [[43, 58.7], [45.5, 59.8], [49, 60.5], [52.5, 59.9], [55.8, 57.6]] },
  },
};
const SECOND_HINT_AFTER = 2; // 이만큼 틀리면 두 번째 힌트(글자 수·첫 글자 / 오답 지우기)
// 턱을 내리는 입의 모양: curve 가 있으면 웃는 입선을 따라 초승달처럼 벌어짐
const jawShapes = (m) => {
  const { jaw } = m;
  if (!jaw.curve) {
    return { jawClip: `inset(${m.y}% 0 0 0)`, innerClip: null };
  }
  const pts = jaw.curve;
  const depth = jaw.drop * 1.7;
  const x0 = pts[0][0];
  const x1 = pts[pts.length - 1][0];
  const mid = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  const top = pts.map(([x, y]) => `${x}% ${y}%`);
  const bottom = pts
    .map(([x, y]) => `${x}% ${(y + depth * Math.max(0, 1 - ((x - mid) / half) ** 2)).toFixed(2)}%`)
    .reverse();
  return {
    innerClip: `polygon(${[...top, ...bottom].join(', ')})`,
    jawClip: `polygon(0% ${pts[0][1]}%, ${top.join(', ')}, 100% ${pts[pts.length - 1][1]}%, 100% 100%, 0% 100%)`,
  };
};
const mouthOf = (src) => (src ? MOUTH[String(src).split('/').pop()] || null : null);

// 인물별 목소리: id = 미리 만든 음성 파일 이름(audio/voice/<id>-<해시>.mp3)
// 실제 목소리 설정(성우·빠르기·높낮이)은 tools/make_voices.py 의 VOICES 에 있습니다.
// pitch·rate 는 음성 파일이 없을 때 쓰는 브라우저 내장 음성용 예비 값입니다.
const VOICE = {
  [NARRATOR]: { id: 'narrator', pitch: 1, rate: 0.95, playbackRate: 1.2 }, // 음성 파일을 1.2배 빠르게 재생
  학예연구사: { id: 'curator', pitch: 1.2, rate: 1.03, playbackRate: 1.15 },
  노승: { id: 'monk', pitch: 0.7, rate: 0.85, playbackRate: 1.15 },
  '백제 수문장': { id: 'gatekeeper', pitch: 0.6, rate: 0.95, playbackRate: 1.15 },
  뱃사공: { id: 'boatman', pitch: 0.8, rate: 0.9, playbackRate: 1.15 },
  궁녀: { id: 'court_lady', pitch: 1.35, rate: 1, playbackRate: 1.25 },
  능지기: { id: 'tomb_keeper', pitch: 0.65, rate: 0.85, playbackRate: 1.15 },
  해설사: { id: 'docent', pitch: 0.95, rate: 1, playbackRate: 1.15 },
};
const HERO_VOICE = {
  beast: { id: 'hero_beast', pitch: 1.6, rate: 1.08, playbackRate: 1.1 },
  human: { id: 'hero_human', pitch: 1.1, rate: 1.02, playbackRate: 1.3 }, // 각성 장면은 빠르게 해야 벅찬 감정이 살아남
};

// 대사 → 음성 파일 경로 (tools/make_voices.py 와 같은 FNV-1a 해시)
const textHash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};
const voiceFile = (id, text) => `audio/voice/${id}-${textHash(text)}.mp3`;

/* ---------- 효과음: Web Audio로 직접 합성 (음원 파일 없음) ---------- */
const Sound = (() => {
  let ctx = null;
  const ac = () => {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  };
  const tone = (freq, start, dur, { type = 'sine', gain = 0.15 } = {}) => {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  return {
    unlock: () => ac(), // 첫 클릭 때 호출해 두면 모바일에서도 소리가 납니다
    context: () => ac(),
    correct() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(f, i * 0.09, 0.55, { type: 'triangle', gain: 0.18 });
        tone(f * 2, i * 0.09, 0.3, { gain: 0.04 });
      });
      [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.45 + i * 0.07, 0.7, { gain: 0.05 }));
    },
    wrong() {
      tone(233, 0, 0.16, { type: 'square', gain: 0.05 });
      tone(175, 0.14, 0.3, { type: 'square', gain: 0.05 });
    },
    blip(pitch = 1) {
      tone(480 * pitch + Math.random() * 40, 0, 0.045, { type: 'square', gain: 0.018 });
    },
    // 금동이 변신: 2.7초 동안 차오르다가 번쩍
    awaken() {
      const c = ac();
      if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 2.7);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(600, t);
      f.frequency.exponentialRampToValueAtTime(4000, t + 2.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 2.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      o.connect(f);
      f.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + 2.9);
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((fr, i) => tone(fr, 2.75 + i * 0.05, 2.2, { type: 'triangle', gain: 0.1 }));
      [2093, 2637, 3136, 4186].forEach((fr, i) => tone(fr, 2.9 + i * 0.09, 1.2, { gain: 0.04 }));
    },
    finale() {
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 1.4, { type: 'triangle', gain: 0.12 }));
    },
  };
})();

/* ---------- 음성 읽기: 브라우저 내장 Web Speech (기기마다 목소리가 다름) ---------- */
const Speech = (() => {
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voice = null;
  const pick = () => {
    if (!ok) return;
    const vs = window.speechSynthesis.getVoices();
    voice = vs.find((v) => /^ko/i.test(v.lang) && /google|yuna|heami|sunhi/i.test(v.name)) || vs.find((v) => /^ko/i.test(v.lang)) || null;
  };
  if (ok) {
    pick();
    window.speechSynthesis.addEventListener?.('voiceschanged', pick);
  }
  return {
    supported: ok,
    speak(text, { pitch = 1, rate = 1 } = {}, onStart, onEnd) {
      if (!ok) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[《》「」『』"“”]/g, ' '));
      u.lang = 'ko-KR';
      if (voice) u.voice = voice;
      u.pitch = pitch;
      u.rate = rate;
      u.onstart = onStart;
      u.onend = onEnd;
      u.onerror = onEnd;
      window.speechSynthesis.speak(u);
    },
    stop() {
      if (ok) window.speechSynthesis.cancel();
    },
  };
})();

/* ---------- 대사 음성 재생: 미리 만든 mp3, 없으면 브라우저 내장 음성으로 대신 ---------- */
const VoicePlayer = (() => {
  const ok = typeof window !== 'undefined' && typeof window.Audio === 'function';
  // 오디오 요소 하나를 계속 재사용해야 모바일(iOS)에서 첫 터치 이후에도 자동 재생이 됩니다
  const audio = ok ? new window.Audio() : null;
  let token = 0;
  // 말소리 크기 측정용: 오디오 → 분석기 → 스피커 (http/https 에서만, 파일로 열면 소리가 막힐 수 있어 건너뜀)
  let analyser = null;
  let buf = null;
  const connect = () => {
    if (analyser || !audio || !/^https?:$/.test(window.location.protocol)) return;
    const c = Sound.context();
    if (!c) return;
    try {
      const src = c.createMediaElementSource(audio);
      analyser = c.createAnalyser();
      analyser.fftSize = 1024;
      buf = new Float32Array(analyser.fftSize);
      src.connect(analyser);
      analyser.connect(c.destination);
    } catch {
      analyser = null;
    }
  };
  // 태블릿에서 앱을 내렸다 올리면 오디오가 잠들 수 있어, 화면을 누를 때마다 깨움
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => {
      if (analyser) Sound.context();
    }, { passive: true });
  }
  // 0.05초 무음 WAV (첫 터치 때 재생해 오디오 잠금을 풉니다)
  const SILENT = (() => {
    const n = 400;
    const b = new Uint8Array(44 + n);
    const v = new DataView(b.buffer);
    const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
    let bin = '';
    b.forEach((x) => { bin += String.fromCharCode(x); });
    return `data:audio/wav;base64,${btoa(bin)}`;
  })();
  return {
    unlock() {
      if (!audio) return;
      connect();
      try {
        audio.src = SILENT;
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* 무시 */
      }
    },
    // 재생 시작 시 onStart, 끝나면 onEnd. 파일을 못 불러오면 fallback(브라우저 음성) 실행
    // rate: 재생 속도(음 높이 유지), onBlocked: 브라우저가 자동 재생을 막았을 때
    play(src, { onStart, onEnd, fallback, rate = 1, onBlocked } = {}) {
      if (!audio) {
        if (fallback) fallback();
        return;
      }
      const my = ++token;
      const mine = (fn) => (...args) => {
        if (my === token && fn) fn(...args);
      };
      audio.onplaying = mine(onStart);
      audio.onended = mine(onEnd);
      audio.onerror = mine(() => {
        if (onEnd) onEnd();
        if (fallback) fallback();
      });
      audio.src = src;
      audio.preservesPitch = true;
      audio.webkitPreservesPitch = true;
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      if (analyser) Sound.context(); // 멈춰 있던 오디오 컨텍스트 깨우기
      const p = audio.play();
      if (p && p.catch) {
        p.catch(
          mine((err) => {
            // 자동 재생이 막힌 경우(NotAllowedError)는 조용히 넘어가고, 그 외에는 내장 음성으로
            if (onEnd) onEnd();
            if (err && err.name === 'NotAllowedError' && onBlocked) onBlocked();
            if (err && err.name !== 'NotAllowedError' && err.name !== 'AbortError' && fallback) fallback();
          }),
        );
      }
    },
    // 지금 나오는 음성의 크기 0~1 (음성 파일이 재생 중이 아니면 null → 입은 기본 움직임)
    level() {
      if (!analyser || !audio || audio.paused || audio.ended) return null;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      return Math.max(0, Math.min(1, (rms - 0.02) * 4));
    },
    stop() {
      token += 1;
      if (audio) {
        audio.pause();
        audio.onplaying = audio.onended = audio.onerror = null;
      }
      Speech.stop();
    },
  };
})();

/* ---------- 진행 저장 (브라우저 localStorage, 새로고침해도 이어하기) ---------- */
const SAVE_KEY = 'buyeo-time-detective:save:v1';
const SETTINGS_KEY = 'buyeo-time-detective:settings:v1';
const readJSON = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeJSON = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 불가(사생활 보호 모드 등)여도 게임은 그대로 진행 */
  }
};
const removeKey = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
};

// 보상 아이템 이미지가 없을 때 메달에 새길 아이콘
const ITEM_ICON = {
  museum: Feather,
  jeongnimsa: Stamp,
  busosanseong: Leaf,
  baengmagang: Compass,
  gungnamji: Sprout,
  royaltombs: Sun,
  sindongyeop: ScrollText,
};

// 7개 장소 메타데이터 + 스테이지 콘텐츠
const STAGES = [
  {
    id: 'museum',
    order: 1,
    name: '국립부여박물관',
    era: '탐방 시작점',
    // 사진 경로: 상대경로(images/...) 또는 https:// 주소. 비워 두면('') 그라데이션 대체 화면이 나옵니다.
    image: 'images/museum.jpg',
    description:
      '백제금동대향로가 잠들어 있던 곳. 봉인이 풀린 진열장 앞에서 수사가 시작된다.',
    rewardItem: {
      name: '봉황의 깃털 조각',
      shortName: '봉황 깃털',
      // 보상 아이템 이미지 (투명 배경 PNG 권장). 비워 두면 금빛 메달 아이콘으로 대체됩니다.
      image: './images/items/phoenix.png',
      description: '향로 뚜껑 꼭대기 봉황에게서 떨어져 나온 금빛 깃털. 첫 번째 봉인이다.',
      // 탐정 수첩에서 유물을 누르면 보이는 백제 역사 상식
      trivia: {
        title: '백제금동대향로',
        text: "1993년 부여 능산리 절터의 진흙 구덩이에서 발견된 국보입니다. 높이 61.8cm로, 꼭대기 봉황 아래 뚜껑에는 74개의 산봉우리와 다섯 악사, 여러 동물과 신선이 새겨져 있고, 몸체는 연꽃, 받침은 용이 떠받치고 있습니다.",
      },
    },
    npc: { name: '학예연구사', role: '국립부여박물관 학예연구사' },
    dialogues: [
      {
        speaker: NARRATOR,
        avatar: null,
        text: '자정이 막 지난 국립부여박물관. 텅 빈 향로 진열장 앞에서 학예연구사가 수사관을 기다리고 있다.',
      },
      {
        speaker: '학예연구사',
        avatar: './images/characters/curator.png',
        text: '오셨군요, 수사관님. 어젯밤 자정, 백제금동대향로 진열장에서 금빛이 번쩍이더니 향로에 깃든 일곱 개의 봉인이 사라졌습니다.',
      },
      {
        speaker: '학예연구사',
        avatar: './images/characters/curator.png',
        text: '향로는 1993년 능산리 절터에서 진흙 속에 묻힌 채 발견됐어요. 높이 61.8cm, 뚜껑에는 산과 신선, 동물들이 빼곡히 새겨져 있죠.',
      },
      {
        speaker: '학예연구사',
        avatar: './images/characters/curator.png',
        text: '봉인들은 부여의 일곱 유적지로 흩어졌습니다. 그런데 첫 번째 봉인은 아직 이 전시실에 희미하게 남아 있어요.',
      },
      {
        speaker: '수사관 (나)',
        avatar: null, // 주인공 대사는 각성 여부에 따라 HERO_AVATAR_BEAST / HERO_AVATAR_HUMAN 이 자동으로 쓰입니다
        text: '진열장 유리에 무언가 새겨져 있군요. "향로의 가장 높은 곳에 선 자의 이름을 부르라."',
      },
      {
        speaker: '학예연구사',
        avatar: './images/characters/curator.png',
        text: '향로의 가장 높은 곳이라면… 뚜껑 꼭대기를 말하는 거예요. 그 이름을 정확히 말해야 봉인이 응답할 겁니다.',
      },
    ],
    quiz: {
      type: 'text',
      question: '금동대향로 뚜껑 최정상에서 여의주를 품고 날개를 펼친 상상의 새는 무엇인가?',
      placeholder: '정답을 입력하세요 (예: 두 글자)',
      answers: ['봉황'],
      hint: '용과 함께 동아시아에서 상서로운 존재로 여겨진 새예요. 수컷 "봉"과 암컷 "황"을 합쳐 부릅니다.',
      successMessage: '정답입니다! 진열장 위로 금빛 깃털이 내려앉았습니다.',
      failMessage: '봉인이 반응하지 않습니다. 향로 꼭대기의 새를 다시 떠올려 보세요.',
    },
    clearDialogues: [
      {
        speaker: '학예연구사',
        avatar: './images/characters/curator.png',
        text: '봉황…! 맞아요. 봉황은 태평성대에만 나타난다는 새죠. 깃털 조각이 첫 번째 봉인이었군요.',
      },
      {
        speaker: '학예연구사',
        avatar: './images/characters/curator.png',
        next: 'jeongnimsa',
        text: '깃털이 가리키는 빛이 서쪽, 정림사지 오층석탑 쪽으로 뻗어 있어요. 다음 봉인은 그곳에 있을 겁니다.',
      },
    ],
  },
  {
    id: 'jeongnimsa',
    order: 2,
    name: '정림사지',
    era: '사비 도성의 중심 사찰',
    // 사진 경로: 상대경로(images/...) 또는 https:// 주소. 비워 두면('') 그라데이션 대체 화면이 나옵니다.
    image: 'images/jeongnimsa.jpg',
    imageFit: 'contain', // 세로 사진: 석탑이 잘리지 않게 전체를 보여 주고 양옆은 흐린 배경으로
    description: '1,400년을 버텨 온 오층석탑이 서 있는 사찰 터. 탑의 돌마다 오래된 글자가 남아 있다.',
    rewardItem: {
      name: '먹물 탁본 조각',
      shortName: '먹물 탁본',
      // 보상 아이템 이미지 (투명 배경 PNG 권장). 비워 두면 금빛 메달 아이콘으로 대체됩니다.
      image: './images/items/rubbing.png',
      description: '오층석탑 1층 탑신에 새겨진 역사의 흔적이 담긴 탁본.',
      // 탐정 수첩에서 유물을 누르면 보이는 백제 역사 상식
      trivia: {
        title: '정림사지 오층석탑',
        text: "사비 백제를 대표하는 국보 석탑으로 높이는 약 8.3m입니다. 1층 탑신에 당나라 장수 소정방이 새긴 「대당평백제국비명」 때문에 한때 '평제탑'이라 잘못 불리기도 했습니다.",
      },
    },
    npc: { name: '노승', role: '정림사지를 돌보는 노승' },
    dialogues: [
      {
        speaker: NARRATOR,
        avatar: null,
        text: '새벽안개가 내려앉은 정림사지. 천사백 년을 버틴 오층석탑 아래에서 노승이 조용히 염주를 굴리고 있다.',
      },
      {
        speaker: '노승',
        avatar: './images/characters/monk.png',
        text: '나무아미타불… 백제가 멸망하고 절터는 모두 불타 사라졌으나, 이 석탑만큼은 천년 넘게 자리를 지키고 있지요.',
      },
      {
        speaker: '노승',
        avatar: './images/characters/monk.png',
        text: '탑의 1층 탑신을 자세히 보시게. 당나라 장수 소정방이 백제를 멸망시킨 뒤 자신의 전공을 새겨놓은 가슴 아픈 흔적이 남아있다네.',
      },
      {
        speaker: '노승',
        avatar: './images/characters/monk.png',
        text: '탑의 기운을 얻으려면, 이 탑의 올바른 이름과 층수를 정확히 알아야 하오.',
      },
    ],
    quiz: {
      type: 'choice',
      question: '정림사지에 우뚝 서 있는 국보 석탑의 올바른 층수는 몇 층인가?',
      choices: ['3층 석탑', '5층 석탑', '7층 석탑', '9층 석탑'],
      answers: ['5층 석탑', '5층'],
      hint: '사비 백제 석탑의 세련된 비례미를 보여주는 대표적인 홀수 층수 탑입니다.',
      successMessage: '정답입니다! 탑신에 새겨진 두 번째 봉인 조각을 확보했습니다.',
      failMessage: '탑의 비례를 다시 살펴보십시오. 알맞은 층수가 아닙니다.',
    },
    clearDialogues: [
      {
        speaker: '노승',
        avatar: './images/characters/monk.png',
        text: '그렇소, 5층 석탑이지. 간결하면서도 아름다운 처마선이 백제의 멋을 그대로 품고 있다네.',
      },
      {
        speaker: '노승',
        avatar: './images/characters/monk.png',
        next: 'busosanseong',
        text: '다음 봉인은 사비도성의 최후 요새, 부소산성 쪽에서 서늘한 기운을 내뿜고 있소.',
      },
    ],
  },
  {
    id: 'busosanseong',
    order: 3,
    name: '부소산성',
    era: '사비 도성의 마지막 방어선',
    // 사진 경로: 상대경로(images/...) 또는 https:// 주소. 비워 두면('') 그라데이션 대체 화면이 나옵니다.
    image: 'images/busosanseong.jpg',
    description: '백제 왕궁의 뒷산이자 최후의 요새. 낙화암과 고란사가 숲길 끝에 숨어 있다.',
    rewardItem: {
      name: '고란초 잎',
      shortName: '고란초 잎',
      // 보상 아이템 이미지 (투명 배경 PNG 권장). 비워 두면 금빛 메달 아이콘으로 대체됩니다.
      image: './images/items/gorancho.png',
      description: '낙화암 아래 고란사 바위틈에서 자란 신비한 잎.',
      // 탐정 수첩에서 유물을 누르면 보이는 백제 역사 상식
      trivia: {
        title: '사비 도성의 배후 산성',
        text: "538년 성왕이 사비로 도읍을 옮긴 뒤 왕궁 뒤편을 지키던 산성입니다. 성 안에는 백제의 세 충신 성충·흥수·계백을 모신 삼충사와 낙화암, 고란사가 있습니다.",
      },
    },
    npc: { name: '백제 수문장', role: '부소산성을 지키는 수문장' },
    dialogues: [
      {
        speaker: NARRATOR,
        avatar: null,
        text: '솔바람이 서늘한 부소산성 숲길. 갑옷 차림의 백제 수문장이 매서운 눈빛으로 길을 막아선다.',
      },
      {
        speaker: '백제 수문장',
        avatar: './images/characters/gatekeeper.png',
        text: '게 섰거라! 사비도성의 북쪽을 지키는 부소산성에 들려면 백제의 충절과 역사를 알아야 한다.',
      },
      {
        speaker: '백제 수문장',
        avatar: './images/characters/gatekeeper.png',
        text: '이 산성 안에는 세 충신을 모신 사당과 백마강이 내려다보이는 낙화암, 그리고 바위틈에서 물이 솟는 고란사가 있지.',
      },
      {
        speaker: '백제 수문장',
        avatar: './images/characters/gatekeeper.png',
        text: '마시면 젊어진다는 전설의 약수와 그 뒤편 바위틈에서만 자라는 희귀한 풀의 이름을 말해보아라.',
      },
    ],
    quiz: {
      type: 'text',
      question: '부소산성 북쪽 사찰 바위틈에서 자라며, 왕들이 약수물 잔에 띄웠다고 전해지는 이 식물의 이름은?',
      placeholder: '식물 이름 입력 (3글자)',
      answers: ['고란초'],
      hint: "낙화암 아래 자리한 사찰 '고란사'의 이름 유래가 된 양치식물입니다. OO초",
      successMessage: '정답이다! 이슬 맺힌 고란초 잎과 함께 세 번째 봉인이 풀렸도다.',
      failMessage: '그 풀이 아니다. 바위틈에서 자라는 사찰 이름의 유래가 된 식물을 떠올려보라.',
    },
    clearDialogues: [
      {
        speaker: '백제 수문장',
        avatar: './images/characters/gatekeeper.png',
        text: '고란초라! 임금님께서도 그 잎이 뜬 약수를 드시며 기운을 얻으셨지.',
      },
      {
        speaker: '백제 수문장',
        avatar: './images/characters/gatekeeper.png',
        next: 'baengmagang',
        text: '이제 강바람이 불어오는 백마강 구드래 나루터로 발길을 옮겨보아라.',
      },
    ],
  },
  {
    id: 'baengmagang',
    order: 4,
    name: '백마강',
    era: '사비를 감싸 흐르는 강',
    // 사진 경로: 상대경로(images/...) 또는 https:// 주소. 비워 두면('') 그라데이션 대체 화면이 나옵니다.
    image: 'images/baengmagang.jpg',
    description: '금강이 부여를 지날 때 부르는 이름. 황포돛배가 오가는 물길에 봉인의 빛이 일렁인다.',
    rewardItem: {
      name: '나루터 나침반',
      shortName: '나침반',
      // 보상 아이템 이미지 (투명 배경 PNG 권장). 비워 두면 금빛 메달 아이콘으로 대체됩니다.
      image: './images/items/compass.png',
      description: '물길을 안내하고 사비의 역사를 가리키는 나침반.',
      // 탐정 수첩에서 유물을 누르면 보이는 백제 역사 상식
      trivia: {
        title: '백마강 이름의 전설',
        text: "금강 가운데 부여를 지나는 구간을 백마강이라 부릅니다. 당나라 장수 소정방이 백마를 미끼로 강의 용을 낚았다는 '조룡대' 전설이 이름과 함께 전해집니다.",
      },
    },
    npc: { name: '뱃사공', role: '백마강 황포돛배 뱃사공' },
    dialogues: [
      {
        speaker: NARRATOR,
        avatar: null,
        text: '황포돛배가 물결에 흔들리는 구드래나루. 노를 쥔 뱃사공이 강 건너 낙화암을 바라보고 있다.',
      },
      {
        speaker: '뱃사공',
        avatar: './images/characters/boatman.png',
        text: '구드래나루에서 고란사까지 노를 젓는 뱃사공입니다. 물결 아래로 백제의 슬픈 역사가 흐르고 있지요.',
      },
      {
        speaker: '뱃사공',
        avatar: './images/characters/boatman.png',
        text: '백마강은 금강 줄기 중에서도 부여를 감싸 흐르는 이 구간을 특별히 부르는 이름입니다.',
      },
      {
        speaker: '뱃사공',
        avatar: './images/characters/boatman.png',
        text: '저기 깎아지른 절벽 낙화암을 보십시오. 꽃처럼 떨어진 넋을 기리기 위해 절벽 꼭대기에 세운 육각 정자가 무엇인지 아십니까?',
      },
    ],
    quiz: {
      type: 'choice',
      question: '낙화암 절벽 꼭대기에 백제 여인들의 넋을 추모하기 위해 세워진 육각형 정자의 이름은?',
      choices: ['망해정', '백화정', '영일루', '사자루'],
      answers: ['백화정'],
      hint: '온갖 꽃들이 흐드러지게 핀다는 뜻을 품고 있는 정자입니다.',
      successMessage: '정답입니다! 강바람 속에서 네 번째 봉인인 나루터 나침반을 건네받았습니다.',
      failMessage: '그 정자가 아닙니다. 백화(百花)의 뜻을 품은 정자를 찾아보세요.',
    },
    clearDialogues: [
      {
        speaker: '뱃사공',
        avatar: './images/characters/boatman.png',
        text: '맞습니다, 백화정이지요. 꽃처럼 떨어진 여인들의 넋이 꽃이 되어 피어난 곳입니다.',
      },
      {
        speaker: '뱃사공',
        avatar: './images/characters/boatman.png',
        next: 'gungnamji',
        text: '나침반 바늘이 남쪽, 아름다운 연못이 있는 궁남지를 가리키고 있군요.',
      },
    ],
  },
  {
    id: 'gungnamji',
    order: 5,
    name: '궁남지',
    era: '우리나라 최초의 인공 연못',
    // 사진 경로: 상대경로(images/...) 또는 https:// 주소. 비워 두면('') 그라데이션 대체 화면이 나옵니다.
    image: 'images/gungnamji.jpg',
    description: '무왕 때 궁궐 남쪽에 판 연못. 여름이면 연꽃이 가득하고 가운데 정자가 떠 있다.',
    rewardItem: {
      name: '금빛 연꽃 씨앗',
      shortName: '연꽃 씨앗',
      // 보상 아이템 이미지 (투명 배경 PNG 권장). 비워 두면 금빛 메달 아이콘으로 대체됩니다.
      image: './images/items/lotus_seed.png',
      description: '천 년의 세월을 뛰어넘어 피어나는 서동의 연꽃 씨앗.',
      // 탐정 수첩에서 유물을 누르면 보이는 백제 역사 상식
      trivia: {
        title: '『삼국사기』 속 궁남지',
        text: "『삼국사기』에는 무왕 35년(634년) 궁궐 남쪽에 못을 파고 20여 리 밖에서 물을 끌어들였으며, 네 언덕에 버드나무를 심고 못 가운데 섬을 만들었다는 기록이 있습니다.",
      },
    },
    npc: { name: '궁녀', role: '포룡정을 거니는 여인' },
    dialogues: [
      {
        speaker: NARRATOR,
        avatar: null,
        text: '연꽃 향이 은은한 궁남지. 포룡정으로 이어진 다리 위를 한 궁녀가 천천히 거닐고 있다.',
      },
      {
        speaker: '궁녀',
        avatar: './images/characters/court_lady.png',
        text: '궁궐 남쪽에 못을 파고 이십여 리 밖에서 물을 끌어들여 만든 우리나라 최초의 인공 연못이랍니다.',
      },
      {
        speaker: '궁녀',
        avatar: './images/characters/court_lady.png',
        text: '여름이면 연꽃이 만발하고, 연못 한가운데 포룡정으로 향하는 다리는 운치가 있지요.',
      },
      {
        speaker: '궁녀',
        avatar: './images/characters/court_lady.png',
        text: '이 연못을 만든 백제의 제30대 왕은 어릴 적 마를 캐며 서동요를 불렀던 인물입니다. 그 왕의 이름(시호)은 무엇일까요?',
      },
    ],
    quiz: {
      type: 'text',
      question: '신라 선화공주와 혼인하고 궁남지를 축조한 백제의 제30대 왕은 누구인가?',
      placeholder: '왕의 이름 입력 (예: 문왕)',
      answers: ['무왕', '백제무왕', '서동'],
      hint: '서동요 설화의 주인공이자 훗날 익산 미륵사를 세운 왕입니다.',
      successMessage: '정답입니다! 연못 수면 위로 금빛 연꽃 씨앗이 떠올랐습니다.',
      failMessage: '그 왕이 아닙니다. 서동으로 불렸던 백제의 왕을 떠올려 보세요.',
    },
    clearDialogues: [
      {
        speaker: '궁녀',
        avatar: './images/characters/court_lady.png',
        text: '무왕이시지요! 마를 캐던 소년 서동에서 한 나라의 위대한 왕이 되신 분이랍니다.',
      },
      {
        speaker: '궁녀',
        avatar: './images/characters/court_lady.png',
        next: 'royaltombs',
        text: '이제 역대 왕들이 고이 잠들어 계신 부여왕릉원으로 가보셔야 합니다.',
      },
    ],
  },
  {
    id: 'royaltombs',
    order: 6,
    name: '부여왕릉원',
    era: '사비 시대 왕들의 무덤',
    // 사진 경로: 상대경로(images/...) 또는 https:// 주소. 비워 두면('') 그라데이션 대체 화면이 나옵니다.
    image: 'images/royaltombs.jpg',
    description: '능산리 고분군이 모인 곳. 바로 옆 절터에서 금동대향로가 발견되었다.',
    rewardItem: {
      name: '사신도 청동 거울',
      shortName: '청동 거울',
      // 보상 아이템 이미지 (투명 배경 PNG 권장). 비워 두면 금빛 메달 아이콘으로 대체됩니다.
      image: './images/items/mirror.png',
      description: '고분 벽화 속 사신도의 기운이 깃든 거울.',
      // 탐정 수첩에서 유물을 누르면 보이는 백제 역사 상식
      trivia: {
        title: '세계유산 백제역사유적지구',
        text: "능산리 고분군(부여왕릉원)은 2015년 정림사지, 부소산성 등과 함께 유네스코 세계유산 '백제역사유적지구'로 등재되었습니다. 동하총 벽화에는 사신도와 연꽃·구름무늬가 남아 있습니다.",
      },
    },
    npc: { name: '능지기', role: '능산리 고분군을 지키는 자' },
    dialogues: [
      {
        speaker: NARRATOR,
        avatar: null,
        text: '둥근 봉분들이 나란히 잠든 부여왕릉원. 삿갓을 멘 능지기가 고분 곁을 묵묵히 지키고 있다.',
      },
      {
        speaker: '능지기',
        avatar: './images/characters/tomb_keeper.png',
        text: '이곳은 사비 시대 백제의 역대 왕과 왕족들이 영면해 계신 신성한 능산리 고분군입니다.',
      },
      {
        speaker: '능지기',
        avatar: './images/characters/tomb_keeper.png',
        text: '특히 1호분 동하총 벽면에는 무덤을 수호하는 네 방위의 신수가 그려져 있었지요.',
      },
      {
        speaker: '능지기',
        avatar: './images/characters/tomb_keeper.png',
        text: "벽화 속 사신도 중 '동쪽'과 '서쪽'을 수호하는 신수의 올바른 짝을 맞추어야 결계가 풀립니다.",
      },
    ],
    quiz: {
      type: 'choice',
      question: "능산리 동하총 벽화의 사신도 중 '동쪽'과 '서쪽'을 상징하는 수호신의 올바른 조합은?",
      choices: ['① 동: 주작 - 서: 현무', '② 동: 청룡 - 서: 백호', '③ 동: 백호 - 서: 청룡', '④ 동: 현무 - 서: 주작'],
      answers: ['② 동: 청룡 - 서: 백호', '동: 청룡 - 서: 백호', '2번', '2'],
      hint: '흔히 좌청룡 우백호라고 부르는 방위 배치를 떠올려 보세요.',
      successMessage: '정답입니다! 고분의 결계가 풀리며 사신도 청동 거울을 회수했습니다.',
      failMessage: '방위와 신수의 짝이 맞지 않습니다. 좌청룡 우백호를 기억하세요.',
    },
    clearDialogues: [
      {
        speaker: '능지기',
        avatar: './images/characters/tomb_keeper.png',
        text: '동쪽의 청룡과 서쪽의 백호가 맞소! 천년의 어둠 속에서도 벽화는 선명한 빛을 품고 있었지요.',
      },
      {
        speaker: '능지기',
        avatar: './images/characters/tomb_keeper.png',
        next: 'sindongyeop',
        text: '일곱 번째 봉인은 백제의 얼을 현대의 언어로 노래한 신동엽 문학관에 있습니다.',
      },
    ],
  },
  {
    id: 'sindongyeop',
    order: 7,
    name: '신동엽 문학관',
    era: '시인의 생가와 문학관',
    // 사진 경로: 상대경로(images/...) 또는 https:// 주소. 비워 두면('') 그라데이션 대체 화면이 나옵니다.
    image: 'images/sindongyeop.jpg',
    description: '「껍데기는 가라」의 시인 신동엽을 기리는 곳. 마지막 봉인이 시 한 구절 속에 숨어 있다.',
    rewardItem: {
      name: '순수의 시 구절',
      shortName: '시 구절',
      // 보상 아이템 이미지 (투명 배경 PNG 권장). 비워 두면 금빛 메달 아이콘으로 대체됩니다.
      image: './images/items/poem.png',
      description: '껍데기를 몰아내고 알맹이만 남긴 시인의 마지막 열쇠.',
      // 탐정 수첩에서 유물을 누르면 보이는 백제 역사 상식
      trivia: {
        title: '시인 신동엽',
        text: "1930년 부여에서 태어난 시인으로, 1967년 동학농민운동을 노래한 서사시 「금강」과 「껍데기는 가라」를 발표했습니다. 부여 생가 옆에 2013년 신동엽문학관이 문을 열었습니다.",
      },
    },
    npc: { name: '해설사', role: '신동엽 문학관 해설사' },
    dialogues: [
      {
        speaker: NARRATOR,
        avatar: null,
        text: '시인이 나고 자란 옛집 곁, 신동엽 문학관. 해설사가 시 구절이 걸린 벽 앞에서 수사관을 맞이한다.',
      },
      {
        speaker: '해설사',
        avatar: './images/characters/docent.png',
        text: '수사관님, 이번 여정은 백제의 고도 부여에서 태어나 역사를 노래한 민족시인 신동엽 문학관입니다.',
      },
      {
        speaker: '해설사',
        avatar: './images/characters/docent.png',
        text: '시인은 대서사시 《금강》을 통해 이곳 부여와 역사의 아픔을 온몸으로 노래하셨지요.',
      },
      {
        speaker: '해설사',
        avatar: './images/characters/docent.png',
        text: '이 봉인을 풀려면 모든 가식과 껍데기를 몰아내자는 그의 대표 시 구절을 완성해야 합니다.',
      },
    ],
    quiz: {
      type: 'text',
      question:
        "신동엽 시인의 대표작 《껍데기는 가라》 구절입니다. 빈칸에 들어갈 낱말은?\n'껍데기는 가라. / 四月도 ( 빈칸 )만 남고 / 껍데기는 가라.'",
      placeholder: '빈칸의 낱말 입력',
      answers: ['알맹이'],
      hint: '껍데기와 정반대되는 핵심 실체를 뜻하는 순우리말입니다.',
      successMessage: "완벽합니다! 일곱 번째 봉인인 '순수의 시 구절'을 획득했습니다!",
      failMessage: '시 구절이 맞지 않습니다. 껍데기의 반대말을 생각해보세요.',
    },
    clearDialogues: [
      {
        speaker: '해설사',
        avatar: './images/characters/docent.png',
        text: '알맹이…! 그렇습니다. 온갖 왜곡과 허식을 걷어내고 순수한 역사의 알맹이만 남기는 것이지요.',
      },
    ],
  },
];
const TOTAL = STAGES.length;

// 클리어 대화 구성: 장소는 순서와 상관없이 풀 수 있으므로
// - next 가 붙은 '다음 장소 안내' 대사는 그 장소가 아직 남아 있을 때만 보여 주고
// - 마지막으로 봉인을 모은 장소에서는 어디든 완성 대사가 이어집니다.
// 시작 화면에서 나레이션이 읽어 주는 소개 글 (화면에 보이는 글과 같은 내용)
const INTRO_NARRATION =
  '국립부여박물관의 백제금동대향로에 깃든 일곱 봉인이 풀려 부여의 유적지로 흩어졌습니다. 특별 수사관인 당신은 각 장소를 탐방하고 단서를 풀어 봉인을 되찾아야 합니다. 막히는 곳이 있으면 다른 유적지부터 먼저 조사해도 괜찮습니다.';

// 공통 대사 (음성 파일을 미리 만들 수 있도록 고정 문장으로 둡니다)
const FINALE_LINE = '일곱 개의 봉인이 모두 모였습니다! 어서 국립부여박물관의 향로로 돌아가 의식을 완성하십시오!';
const AWAKEN_LINE = '이 빛은…! 일곱 봉인의 힘이 하나로 모여 몸 안으로 흘러들어 와. 드디어 본래 모습을 되찾았어!';
const GUIDE_LINES = {
  학예연구사: '아직 찾지 못한 봉인이 남아 있어요. 지도에서 남은 유적지를 골라 수사를 이어 가 주세요.',
  노승: '아직 거두지 못한 봉인이 남아 있소. 지도를 펼쳐 남은 곳으로 발길을 옮기시게.',
  '백제 수문장': '아직 되찾지 못한 봉인이 남아 있다! 지도를 보고 남은 곳으로 서둘러 가거라.',
  뱃사공: '아직 찾을 봉인이 남아 있지요. 지도를 보시고 남은 유적지로 노를 저어 가 보시구려.',
  궁녀: '아직 잠든 봉인이 남아 있답니다. 지도에서 남은 유적지를 찾아가 보셔요.',
  능지기: '아직 깨어나지 않은 봉인이 남아 있소. 지도에서 남은 곳을 찾아가 보시오.',
  해설사: '아직 찾지 못한 봉인이 남아 있습니다. 지도에서 남은 유적지를 골라 보세요.',
};

const buildClearDialogues = (s, visited) => {
  const remaining = TOTAL - visited.length;
  const npc = s.clearDialogues[0];
  const lines = s.clearDialogues.filter((d) => !d.next || (remaining > 0 && !visited.includes(d.next)));
  if (remaining === 0) {
    return [
      ...lines,
      { speaker: npc.speaker, avatar: npc.avatar, text: FINALE_LINE },
      { speaker: '수사관 (나)', avatar: null, text: AWAKEN_LINE },
    ];
  }
  if (!lines.some((d) => d.next)) {
    lines.push({ speaker: npc.speaker, avatar: npc.avatar, text: GUIDE_LINES[npc.speaker] || GUIDE_LINES.해설사 });
  }
  return lines;
};
const normalize = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();
const formatDate = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
const rewardOf = (s) => ({ ...s.rewardItem, stageId: s.id, stageName: s.name });

const INITIAL_STATE = {
  currentStageId: STAGES[0].id,
  visitedStages: [],
  dialogueStep: 0,
  gameStatus: 'intro',
  mistakeCount: 0,
  hintStages: [],
  introReadStages: [],
  attemptsByStage: {},
  completedAt: null,
};

// 저장된 진행을 읽어 오되, 장소 id 등이 맞지 않는 값은 버리고 기본값으로
const loadSave = () => {
  const s = readJSON(SAVE_KEY);
  if (!s || typeof s !== 'object') return INITIAL_STATE;
  const ids = new Set(STAGES.map((x) => x.id));
  const idList = (v) => (Array.isArray(v) ? [...new Set(v.filter((id) => ids.has(id)))] : []);
  const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  const attempts = {};
  if (s.attemptsByStage && typeof s.attemptsByStage === 'object') {
    Object.entries(s.attemptsByStage).forEach(([id, n]) => {
      if (ids.has(id)) attempts[id] = count(n);
    });
  }
  const done = s.completedAt ? new Date(s.completedAt) : null;
  return {
    currentStageId: ids.has(s.currentStageId) ? s.currentStageId : STAGES[0].id,
    visitedStages: idList(s.visitedStages),
    dialogueStep: count(s.dialogueStep),
    gameStatus: s.gameStatus === 'ending' ? 'ending' : s.gameStatus === 'playing' ? 'playing' : 'intro',
    mistakeCount: count(s.mistakeCount),
    hintStages: idList(s.hintStages),
    introReadStages: idList(s.introReadStages),
    attemptsByStage: attempts,
    completedAt: done && !Number.isNaN(done.getTime()) ? done : null,
  };
};

export default function BuyeoTimeDetective() {
  // 새로고침 전 진행 상황 (처음 한 번만 읽음)
  const [saved] = useState(loadSave);

  // ---- 핵심 게임 상태 ----
  const [currentStageId, setCurrentStageId] = useState(saved.currentStageId);
  const [visitedStages, setVisitedStages] = useState(saved.visitedStages);
  const [dialogueStep, setDialogueStep] = useState(saved.dialogueStep);
  const [gameStatus, setGameStatus] = useState('intro'); // 저장이 있어도 인트로에서 '이어서 하기'로 시작
  const inventory = useMemo(() => visitedStages.map((id) => rewardOf(STAGES.find((s) => s.id === id))), [visitedStages]);

  // ---- UI 상태 ----
  const [answerInput, setAnswerInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'fail', message }
  const [attemptsByStage, setAttemptsByStage] = useState(saved.attemptsByStage); // 장소별 오답 횟수 (2번 틀리면 두 번째 힌트)
  const [isNotebookOpen, setNotebookOpen] = useState(false);
  const [rewardPopupId, setRewardPopupId] = useState(null); // 획득 팝업에 띄울 장소 id
  const [awakening, setAwakening] = useState(false); // 엔딩: 금동이 변신 전체 화면 연출

  // ---- 연출 · 기록 상태 ----
  const [celebrateKey, setCelebrateKey] = useState(0); // 값이 바뀔 때마다 축하 이펙트 재생
  const [isCelebrating, setCelebrating] = useState(false);
  const [shakeKey, setShakeKey] = useState(0); // 값이 바뀔 때마다 오답 흔들림 재생
  const [mistakeCount, setMistakeCount] = useState(saved.mistakeCount);
  const [hintStages, setHintStages] = useState(saved.hintStages);
  const [introReadStages, setIntroReadStages] = useState(saved.introReadStages); // 도입 대화를 끝까지 본 장소 (다시 오면 바로 단서로)
  const [completedAt, setCompletedAt] = useState(saved.completedAt);

  // ---- 소리 설정 (효과음 · 음성 읽기) ----
  const [settings, setSettings] = useState(() => ({ sfx: true, voice: true, ...(readJSON(SETTINGS_KEY) || {}) }));
  const sfxOn = settings.sfx !== false;
  const voiceOn = settings.voice !== false;
  const toggleSetting = (key) =>
    setSettings((s) => {
      const next = { ...s, [key]: s[key] === false };
      writeJSON(SETTINGS_KEY, next);
      if (key === 'voice' && !next.voice) VoicePlayer.stop();
      return next;
    });

  // ---- 테스트 모드 ----
  const [testMode, setTestMode] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  const mainRef = useRef(null);
  const lastSubmitRef = useRef(0);

  // 진행할 때마다 저장 (인트로 화면에서는 이전 저장을 덮어쓰지 않음)
  useEffect(() => {
    if (gameStatus === 'intro') return;
    writeJSON(SAVE_KEY, {
      currentStageId,
      visitedStages,
      dialogueStep,
      gameStatus,
      mistakeCount,
      hintStages,
      introReadStages,
      attemptsByStage,
      completedAt: completedAt ? completedAt.toISOString() : null,
    });
  }, [gameStatus, currentStageId, visitedStages, dialogueStep, mistakeCount, hintStages, introReadStages, attemptsByStage, completedAt]);

  // 화면을 떠나거나 엔딩으로 넘어가면 읽던 음성을 멈춤
  useEffect(() => {
    if (gameStatus !== 'playing') VoicePlayer.stop();
  }, [gameStatus]);
  useEffect(() => () => VoicePlayer.stop(), []);

  const stage = useMemo(() => STAGES.find((s) => s.id === currentStageId), [currentStageId]);
  const attempts = attemptsByStage[stage.id] || 0;
  // 저장된 진행이 있고, 처음 상태와 다를 때만 '이어서 하기'
  const canResume =
    saved.gameStatus !== 'intro' &&
    (visitedStages.length > 0 || introReadStages.length > 0 || dialogueStep > 0 || currentStageId !== STAGES[0].id);
  const theme = THEME[stage.id];
  const StageIcon = theme.icon;

  const isCleared = visitedStages.includes(stage.id);
  const isPlayable = stage.dialogues.length > 0 && stage.quiz;
  const clearDialogues = useMemo(() => buildClearDialogues(stage, visitedStages), [stage, visitedStages]);

  // 진행 단계: 대화 → 퀴즈 → 클리어 대화
  const introDone = dialogueStep >= stage.dialogues.length;
  const clearStep = Math.max(0, dialogueStep - stage.dialogues.length);
  const activeDialogue = !isPlayable
    ? null
    : !isCleared
      ? stage.dialogues[Math.min(dialogueStep, stage.dialogues.length - 1)]
      : clearDialogues[Math.min(clearStep, clearDialogues.length - 1)];
  const showQuiz = isPlayable && introDone && !isCleared;
  const clearDialoguesDone = isCleared && clearStep >= clearDialogues.length - 1;
  // 다음 이동 후보: 지금 장소 다음 순서부터 한 바퀴 돌며 아직 못 푼 장소
  const nextStage = [...STAGES.slice(stage.order), ...STAGES.slice(0, stage.order - 1)].find(
    (s) => !visitedStages.includes(s.id),
  );
  const allCleared = visitedStages.length === TOTAL;
  // 일곱 봉인을 모두 모은 순간(또는 엔딩)부터 인간형으로 각성
  const heroMode = allCleared || gameStatus === 'ending' ? 'human' : 'beast';

  const resetStageUI = () => {
    setAnswerInput('');
    setSelectedChoice(null);
    setShowHint(false);
    setFeedback(null);
  };

  useEffect(() => {
    if (!celebrateKey) return undefined;
    setCelebrating(true);
    const t = setTimeout(() => setCelebrating(false), 2600);
    return () => clearTimeout(t);
  }, [celebrateKey]);

  // ---- 동작 ----
  const resetProgress = () => {
    removeKey(SAVE_KEY);
    setCurrentStageId(INITIAL_STATE.currentStageId);
    setVisitedStages([]);
    setDialogueStep(0);
    setNotebookOpen(false);
    setMistakeCount(0);
    setHintStages([]);
    setIntroReadStages([]);
    setAttemptsByStage({});
    setCompletedAt(null);
    setRevealAnswer(false);
    setRewardPopupId(null);
    resetStageUI();
  };

  // 버튼을 누른 순간에 오디오를 깨워 둬야 모바일(특히 iOS)에서 소리가 납니다
  const startGame = () => {
    Sound.unlock();
    VoicePlayer.unlock();
    resetProgress();
    setGameStatus('playing');
  };

  const resumeGame = () => {
    Sound.unlock();
    VoicePlayer.unlock();
    setGameStatus(saved.gameStatus === 'ending' && visitedStages.length === TOTAL ? 'ending' : 'playing');
  };

  const restartGame = () => {
    resetProgress();
    setGameStatus('intro');
  };

  const goToStage = (target) => {
    setCurrentStageId(target.id);
    // 클리어한 장소는 클리어 대화 처음부터, 도입 대화를 이미 본 장소는 바로 단서부터, 처음 온 곳은 도입 대화부터
    const skipIntro = visitedStages.includes(target.id) || introReadStages.includes(target.id);
    setDialogueStep(skipIntro ? target.dialogues.length : 0);
    resetStageUI();
    if (mainRef.current) mainRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNext = () => {
    if (!isCleared && dialogueStep < stage.dialogues.length) {
      if (dialogueStep === stage.dialogues.length - 1) {
        setIntroReadStages((r) => (r.includes(stage.id) ? r : [...r, stage.id]));
      }
      setDialogueStep((n) => n + 1);
    } else if (isCleared && clearStep < clearDialogues.length - 1) {
      setDialogueStep((n) => n + 1);
    }
  };

  // 장소 클리어 처리 (정답 제출과 테스트 모드가 함께 사용)
  const clearStage = (target) => {
    if (visitedStages.includes(target.id)) return;
    const nextVisited = [...visitedStages, target.id];
    setVisitedStages((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]));
    setRewardPopupId(target.id);
    if (sfxOn) Sound.correct();
    setCelebrateKey((k) => k + 1);
    if (nextVisited.length === TOTAL) setCompletedAt(new Date());
  };

  const enterEnding = () => {
    setNotebookOpen(false);
    setRewardPopupId(null);
    setGameStatus('ending');
    setAwakening(true); // 화면 가운데에서 금동이 변신 장면부터
    window.scrollTo({ top: 0 });
  };
  const finishAwakening = () => {
    setAwakening(false);
    setCelebrateKey((k) => k + 1);
    if (sfxOn) Sound.finale();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const quiz = stage.quiz;
    if (!quiz || isCleared) return;

    // 한글 입력(IME) 중 Enter가 두 번 들어오는 브라우저를 위한 중복 제출 방지
    const now = Date.now();
    if (now - lastSubmitRef.current < 350) return;
    lastSubmitRef.current = now;

    const given = quiz.type === 'choice' ? selectedChoice : answerInput;
    if (normalize(given) === '') {
      setFeedback({ type: 'fail', message: quiz.type === 'choice' ? '선택지를 하나 고르세요.' : '정답을 입력하세요.' });
      setShakeKey((k) => k + 1);
      return;
    }

    const correct = quiz.answers.some((a) => normalize(a) === normalize(given));
    if (correct) {
      clearStage(stage);
      setFeedback({ type: 'success', message: quiz.successMessage });
      setDialogueStep(stage.dialogues.length); // 클리어 대화 시작
    } else {
      setAttemptsByStage((m) => ({ ...m, [stage.id]: (m[stage.id] || 0) + 1 }));
      setMistakeCount((n) => n + 1);
      setFeedback({ type: 'fail', message: quiz.failMessage });
      setShakeKey((k) => k + 1);
      if (quiz.type === 'choice') setSelectedChoice(null);
      if (sfxOn) Sound.wrong();
    }
  };

  const toggleHint = () => {
    if (!showHint && !hintStages.includes(stage.id)) setHintStages((h) => [...h, stage.id]);
    setShowHint((v) => !v);
  };

  // ---- 테스트 모드 동작 ----
  const testClearCurrent = () => {
    if (!isPlayable || isCleared) return;
    clearStage(stage);
    setFeedback({ type: 'success', message: '[테스트] 이 장소를 정답 처리했습니다.' });
    setDialogueStep(stage.dialogues.length + buildClearDialogues(stage, [...visitedStages, stage.id]).length - 1);
  };

  const testFinishAll = () => {
    setVisitedStages(STAGES.map((s) => s.id));
    setCompletedAt(new Date());
    enterEnding();
  };

  const overlays = (
    <>
      {isCelebrating && <Celebration key={celebrateKey} big={gameStatus === 'ending'} />}

      {rewardPopupId && gameStatus === 'playing' && (
        <RewardPopup
          stage={STAGES.find((x) => x.id === rewardPopupId)}
          count={inventory.length}
          onClose={() => setRewardPopupId(null)}
        />
      )}

      {isNotebookOpen && (
        <NotebookModal
          inventory={inventory}
          visitedStages={visitedStages}
          onClose={() => setNotebookOpen(false)}
          onRestart={restartGame}
        />
      )}
    </>
  );

  // ======================= 화면: 인트로 =======================
  if (gameStatus === 'intro') {
    return (
      <IntroNarration voiceOn={voiceOn}>
      <Shell>
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="anim-pop w-full max-w-xl text-center">
            {/* 금동대향로: 위쪽은 연기가 피어오르는 여백 */}
            <div className="relative mx-auto -mt-6 mb-3 h-[23rem] w-[12rem] sm:h-[28rem] sm:w-[14rem]">
              <CenserIllustration className="h-full w-full" />
            </div>
            <p className="font-body text-xs tracking-[0.3em] text-[#c9a96b]">BUYEO TIME DETECTIVE</p>
            <h1 className="font-display mt-3 text-3xl leading-tight text-[#f3e7c9] sm:text-4xl" style={{ textWrap: 'balance' }}>
              부여 시간 탐정
              <span className="mt-2 block text-xl text-[#e2b85c] sm:text-2xl">사라진 향로의 봉인</span>
            </h1>
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-[#4a3b26] bg-[#1d1813]/80 p-5 text-left">
              <p className="font-body text-[15px] leading-7 text-[#d9ccb0]">
                국립부여박물관의 <b className="text-[#f3e7c9]">백제금동대향로</b>에 깃든 일곱 봉인이 풀려 부여의 유적지로 흩어졌습니다.
                특별 수사관인 당신은 각 장소를 탐방하고 단서를 풀어 봉인을 되찾아야 합니다.
                막히는 곳이 있으면 다른 유적지부터 먼저 조사해도 괜찮습니다.
              </p>
              <ul className="font-body mt-4 grid grid-cols-2 gap-2 text-[13px] text-[#b8a888]">
                {STAGES.map((s) => {
                  const I = THEME[s.id].icon;
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <I className="h-4 w-4 shrink-0" style={{ color: THEME[s.id].accent }} />
                      <span className="truncate">{s.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {canResume ? (
              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  onClick={resumeGame}
                  className="font-body inline-flex items-center gap-2 rounded-full bg-[#e2b85c] px-8 py-3.5 text-base font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40 active:scale-[0.98]"
                >
                  이어서 수사하기 <span className="font-normal tabular-nums opacity-80">(봉인 {visitedStages.length}/{TOTAL})</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('지금까지 모은 봉인이 모두 사라져요. 처음부터 다시 시작할까요?')) startGame();
                  }}
                  className="font-body inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-[#b8a888] transition hover:bg-white/5 hover:text-[#e8dcc0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/50"
                >
                  <RotateCcw className="h-4 w-4" /> 처음부터 새로 시작
                </button>
              </div>
            ) : (
              <button
                onClick={startGame}
                className="font-body mt-8 inline-flex items-center gap-2 rounded-full bg-[#e2b85c] px-8 py-3.5 text-base font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40 active:scale-[0.98]"
              >
                수사 시작하기 <ChevronRight className="h-5 w-5" />
              </button>
            )}
            <p className="font-body mt-4 text-xs text-[#7d6f57]">진행 상황은 이 기기의 브라우저에 자동으로 저장됩니다.</p>
            <p className="font-body mt-1 text-[11px] text-[#6f6350]">{CENSER_CREDIT}</p>
          </div>
        </div>
      </Shell>
      </IntroNarration>
    );
  }

  // ======================= 화면: 엔딩 =======================
  if (gameStatus === 'ending') {
    return (
      <Shell>
        <EndingScreen
          inventory={inventory}
          completedAt={completedAt}
          mistakeCount={mistakeCount}
          hintCount={hintStages.length}
          onOpenNotebook={() => setNotebookOpen(true)}
          onRestart={restartGame}
          onReplayAwakening={() => setAwakening(true)}
        />
        {overlays}
        {awakening && <AwakeningOverlay sfxOn={sfxOn} onDone={finishAwakening} />}
      </Shell>
    );
  }

  // ======================= 화면: 플레이 =======================
  return (
    <Shell>
      {/* ---------- 상단 헤더 ---------- */}
      <header className="sticky top-0 z-30 border-b border-[#3a2f20] bg-[#14110e]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3">
          <div
            key={heroMode}
            title={heroMode === 'human' ? `${HERO_NAME} · 각성한 인간 수사관` : `${HERO_NAME} · 향로의 정령`}
            className={`portrait-in relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 ${heroMode === 'human' ? 'aura-glow border-[#f6dc94]' : 'border-[#ffd34d]/70'
              }`}
          >
            <HeroAvatar mode={heroMode} crop className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-[15px] leading-tight text-[#f3e7c9] sm:text-lg">부여 시간 탐정</h1>
            <p className="font-body hidden truncate text-xs text-[#9c8c6e] sm:block">사라진 향로의 봉인</p>
          </div>
          <div className="font-body flex shrink-0 items-center gap-1.5 rounded-full border border-[#4a3b26] bg-[#1d1813] px-2.5 py-1.5 text-xs text-[#e8dcc0] sm:gap-2 sm:px-3 sm:text-sm">
            <KeyRound className="h-4 w-4 text-[#e2b85c]" />
            <span className="tabular-nums">
              <span className="hidden sm:inline">봉인 </span>
              {TOTAL}개 중 <b className="text-[#e2b85c]">{visitedStages.length}</b>개
            </span>
          </div>
          <button
            onClick={() => toggleSetting('sfx')}
            aria-pressed={sfxOn}
            aria-label={sfxOn ? '효과음 끄기' : '효과음 켜기'}
            title={sfxOn ? '효과음 끄기' : '효과음 켜기'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60 ${sfxOn ? 'border-[#5a4a32] text-[#e2b85c]' : 'border-[#3a2f20] text-[#6f6350]'
              }`}
          >
            {sfxOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={() => toggleSetting('voice')}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? '대사 음성 끄기' : '대사 음성 켜기'}
            title={voiceOn ? '대사 음성 끄기' : '대사 음성 켜기'}
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60 ${voiceOn ? 'border-[#5a4a32] text-[#e2b85c]' : 'border-[#3a2f20] text-[#6f6350]'
              }`}
          >
            <SpeechIcon className="h-4 w-4" />
            {!voiceOn && <span className="absolute h-[1.5px] w-5 rotate-45 rounded bg-current" aria-hidden="true" />}
          </button>
          {TEST_ENABLED && (
            <button
              onClick={() => {
                setTestMode((v) => !v);
                setRevealAnswer(false);
              }}
              aria-pressed={testMode}
              title="테스트 모드 (검수용 빠른 클리어)"
              className={`font-body inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1.5 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60 ${testMode
                ? 'border-[#d9a441] bg-[#d9a441]/20 text-[#f3cf7a]'
                : 'border-[#3a2f20] text-[#7d6f57] hover:border-[#5a4a32] hover:text-[#b8a888]'
                }`}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">테스트</span>
            </button>
          )}
          <button
            onClick={() => setNotebookOpen(true)}
            className="font-body relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e2b85c] px-3 py-1.5 text-xs font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40 sm:px-4 sm:text-sm"
            aria-label="탐정 수첩 열기"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">탐정 수첩</span>
            {inventory.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#7a2e1f] text-[10px] text-white tabular-nums">
                {inventory.length}
              </span>
            )}
          </button>
        </div>

        {/* 테스트 모드 패널 */}
        {testMode && (
          <div className="border-t border-dashed border-[#d9a441]/40 bg-[#2a2010]">
            <div className="font-body mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-[#f3cf7a]">
                <FlaskConical className="h-3.5 w-3.5" /> 테스트 모드
              </span>
              <span className="text-[#b8a888]">정답 보기와 즉시 클리어를 쓸 수 있어요.</span>
              <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                <button
                  onClick={testClearCurrent}
                  disabled={!isPlayable || isCleared}
                  className="inline-flex items-center gap-1 rounded-full border border-[#d9a441]/50 px-2.5 py-1 text-[#f3cf7a] transition hover:bg-[#d9a441]/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Zap className="h-3.5 w-3.5" /> 현재 장소 즉시 클리어
                </button>
                <button
                  onClick={() => setRevealAnswer((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#d9a441]/50 px-2.5 py-1 text-[#f3cf7a] transition hover:bg-[#d9a441]/15"
                >
                  {revealAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {revealAnswer ? '정답 숨기기' : '정답 보기'}
                </button>
                <button
                  onClick={testFinishAll}
                  className="inline-flex items-center gap-1 rounded-full bg-[#d9a441] px-2.5 py-1 font-bold text-[#1a140c] transition hover:bg-[#f0c25e]"
                >
                  <Award className="h-3.5 w-3.5" /> 엔딩 바로 보기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 진행 바 */}
        <div className="h-1 w-full bg-[#2a2219]">
          <div
            className="h-full bg-gradient-to-r from-[#b0813a] to-[#e2b85c] transition-all duration-700"
            style={{ width: `${(visitedStages.length / TOTAL) * 100}%` }}
          />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------- 메인 카드 ---------- */}
        <main ref={mainRef} className="min-w-0 scroll-mt-28 overflow-hidden rounded-3xl border border-[#3a2f20] bg-[#1a1612] shadow-2xl shadow-black/40">
          {/* 장소 사진 배너 */}
          <section className="relative">
            <StageImage
              key={stage.id}
              src={stage.image}
              alt={`${stage.name} 풍경`}
              stageId={stage.id}
              fit={stage.imageFit || 'cover'}
              className="aspect-[16/9] w-full sm:aspect-[21/9]"
              iconClassName="h-36 w-36 sm:h-52 sm:w-52"
              showPathHint={testMode}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a1612] via-[#1a1612]/40 to-black/25" />
            <div className="font-body absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-4 text-xs sm:p-5">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[#f0e6cc] backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5" style={{ color: theme.accent }} />
                탐방 거점 {stage.order} / {TOTAL}
              </span>
              {isCleared && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1d2a1f]/80 px-2.5 py-1 text-[#bfe3c3] backdrop-blur-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 봉인 회수
                </span>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 sm:gap-4 sm:p-6">
              <div
                className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-black/45 backdrop-blur-sm sm:flex"
                style={{ borderColor: `${theme.accent}66` }}
              >
                <StageIcon className="h-7 w-7" style={{ color: theme.accent }} strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <span className="font-body inline-block rounded-full border border-white/15 bg-black/45 px-2.5 py-0.5 text-[11px] text-[#e4d6b4] backdrop-blur-sm sm:text-xs">
                  {stage.era}
                </span>
                <h2 className="font-display mt-1.5 text-2xl leading-tight text-[#fbf3de] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-4xl">
                  {stage.name}
                </h2>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-5 p-5 sm:p-7">
            <p className="font-body max-w-prose text-[14px] leading-6 text-[#cdbf9f]">{stage.description}</p>

            {/* 준비 중인 스테이지 */}
            {!isPlayable && (
              <div className="font-body flex items-start gap-3 rounded-2xl border border-dashed border-[#5a4a32] bg-[#211b15] p-5">
                <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-[#c9a96b]" />
                <div>
                  <p className="font-bold text-[#f3e7c9]">현장 조사 준비 중</p>
                  <p className="mt-1 text-sm leading-6 text-[#b8a888]">
                    이 장소의 단서와 증인은 아직 준비 중입니다. 지도에서 다른 거점을 확인해 보세요.
                  </p>
                </div>
              </div>
            )}

            {/* NPC 대화창 */}
            {isPlayable && activeDialogue && (
              <DialogueBox
                key={stage.id}
                speaker={activeDialogue.speaker}
                text={activeDialogue.text}
                narration={activeDialogue.speaker === NARRATOR}
                sceneAvatar={stage.dialogues.find((d) => d.speaker !== NARRATOR && !d.speaker.startsWith('수사관'))?.avatar || null}
                sceneName={stage.npc?.name || ''}
                voiceOn={voiceOn}
                sfxOn={sfxOn}
                voiceProfile={
                  activeDialogue.speaker.startsWith('수사관')
                    ? HERO_VOICE[heroMode]
                    : VOICE[activeDialogue.speaker] || { pitch: 1, rate: 1 }
                }
                avatar={
                  activeDialogue.speaker.startsWith('수사관')
                    ? heroMode === 'human'
                      ? HERO_AVATAR_HUMAN
                      : HERO_AVATAR_BEAST
                    : activeDialogue.avatar
                }
                heroMode={heroMode}
                npcRole={stage.npc?.role}
                isPlayer={activeDialogue.speaker.startsWith('수사관')}
                accent={theme.accent}
                progress={
                  isCleared
                    ? `${clearStep + 1} / ${clearDialogues.length}`
                    : `${Math.min(dialogueStep + 1, stage.dialogues.length)} / ${stage.dialogues.length}`
                }
                canNext={(!isCleared && !introDone) || (isCleared && !clearDialoguesDone)}
                nextLabel={!isCleared && dialogueStep === stage.dialogues.length - 1 ? '단서 조사하기' : '다음'}
                onNext={handleNext}
                waitingLabel={!isCleared ? '아래 단서를 풀어 보세요' : null}
              />
            )}

            {/* 퀴즈 패널 */}
            {showQuiz && (
              <QuizPanel
                quiz={stage.quiz}
                answerInput={answerInput}
                setAnswerInput={(v) => {
                  setAnswerInput(v);
                  if (feedback?.type === 'fail') setFeedback(null);
                }}
                selectedChoice={selectedChoice}
                setSelectedChoice={(v) => {
                  setSelectedChoice(v);
                  if (feedback?.type === 'fail') setFeedback(null);
                }}
                showHint={showHint}
                toggleHint={toggleHint}
                onSubmit={handleSubmit}
                attempts={attempts}
                shakeKey={shakeKey}
                revealAnswer={testMode && revealAnswer}
              />
            )}

            {/* 막혔을 때: 다른 유적지 먼저 조사하기 */}
            {showQuiz && nextStage && (
              <div className="font-body flex flex-col gap-2 rounded-2xl border border-[#3a2f20] bg-[#1d1813] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[#b8a888]">막혔나요? 순서와 상관없이 다른 유적지부터 조사해도 돼요.</p>
                <button
                  onClick={() => goToStage(nextStage)}
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-[#6b5636] px-4 py-2 text-[#e8dcc0] transition hover:border-[#e2b85c] hover:text-[#f6ecd2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60"
                >
                  {nextStage.name} 먼저 가기 <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* 피드백 */}
            {feedback && (
              <div
                role="status"
                className={`font-body anim-pop flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${feedback.type === 'success'
                  ? 'success-glow border-[#4f8a5b]/60 bg-[#1d2a1f] text-[#cfeccf]'
                  : 'border-[#9a4632]/60 bg-[#2d1915] text-[#f2c7b9]'
                  }`}
              >
                {feedback.type === 'success' ? (
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#8fd19a]" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#f08a6c]" />
                )}
                <div>
                  <p className="font-bold">{feedback.type === 'success' ? '봉인 해제 성공' : '오답'}</p>
                  <p>{feedback.message}</p>
                  {feedback.type === 'success' && (
                    <p className="mt-1 text-[#a8d6ae]">
                      획득: <b>{stage.rewardItem.name}</b> · 탐정 수첩에 기록되었습니다.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 클리어 후 보상 & 다음 장소 */}
            {isCleared && clearDialoguesDone && (
              <div className="font-body anim-pop flex flex-col gap-3 rounded-2xl border border-[#e2b85c]/40 bg-gradient-to-br from-[#2a2112] to-[#1a1510] p-5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <RewardImage stage={stage} className="h-16 w-16 shrink-0 border border-[#e2b85c]/50 sm:h-20 sm:w-20" iconClassName="h-8 w-8" />
                  <div className="min-w-0">
                    <p className="text-xs tracking-wider text-[#c9a96b]">회수한 봉인</p>
                    <p className="font-bold text-[#f3e7c9]">{stage.rewardItem.name}</p>
                    <p className="text-xs text-[#9c8c6e]">{stage.rewardItem.description}</p>
                  </div>
                </div>
                {allCleared && (
                  <button
                    onClick={enterEnding}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e2b85c] px-5 py-2.5 text-sm font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40"
                  >
                    <Sparkles className="h-4 w-4" /> 향로로 돌아가 의식 완성하기
                  </button>
                )}
                {!allCleared && nextStage && (
                  <button
                    onClick={() => goToStage(nextStage)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e2b85c] px-5 py-2.5 text-sm font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40"
                  >
                    {nextStage.name}(으)로 이동 <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ---------- 지도 네비게이션 ---------- */}
        <aside className="min-w-0 md:sticky md:top-24 md:self-start">
          <div className="rounded-3xl border border-[#3a2f20] bg-[#1a1612] p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="font-display flex items-center gap-2 text-lg text-[#f3e7c9]">
                <MapIcon className="h-5 w-5 text-[#e2b85c]" /> 부여 수사 지도
              </h3>
              <span className="font-body text-xs text-[#9c8c6e] tabular-nums">
                {visitedStages.length}/{TOTAL} 클리어
              </span>
            </div>
            <p className="font-body mb-3 px-1 text-xs text-[#9c8c6e]">순서와 상관없이 원하는 유적지부터 조사할 수 있어요.</p>
            <ol className="relative flex flex-col gap-1.5">
              {/* 경로선 */}
              <span className="pointer-events-none absolute bottom-6 left-[27px] top-6 w-px bg-gradient-to-b from-[#e2b85c]/50 via-[#4a3b26] to-[#4a3b26]" />
              {STAGES.map((s) => {
                const cleared = visitedStages.includes(s.id);
                const current = s.id === currentStageId;
                const I = THEME[s.id].icon;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => goToStage(s)}
                      aria-current={current ? 'location' : undefined}
                      className={`font-body relative flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60 ${current
                        ? 'bg-[#e2b85c]/15 ring-1 ring-[#e2b85c]/50'
                        : 'hover:bg-white/5'
                        }`}
                    >
                      <span
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${cleared
                          ? 'border-[#4f8a5b] bg-[#1d2a1f]'
                          : current
                            ? 'border-[#e2b85c] bg-[#2a2112]'
                            : 'border-[#4a3b26] bg-[#1d1813]'
                          }`}
                      >
                        {cleared ? (
                          <CheckCircle2 className="h-5 w-5 text-[#8fd19a]" />
                        ) : (
                          <I className="h-5 w-5" style={{ color: THEME[s.id].accent }} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#9c8c6e] tabular-nums">{String(s.order).padStart(2, '0')}</span>
                          <span className={`truncate text-sm font-bold ${current ? 'text-[#f6ecd2]' : 'text-[#e0d3b6]'}`}>{s.name}</span>
                        </span>
                        <span className="block truncate text-xs text-[#9c8c6e]">
                          {cleared ? `회수: ${s.rewardItem.name}` : s.era}
                        </span>
                      </span>
                      {current && <span className="shrink-0 rounded-full bg-[#e2b85c] px-2 py-0.5 text-[10px] font-bold text-[#1a140c]">현재</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>

      {overlays}
    </Shell>
  );
}

/* ============================ 하위 컴포넌트 ============================ */

function Shell({ children }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-[#14110e] text-[#e8dcc0]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&display=swap');
        ${TAILWIND_CSS}
        .font-display { font-family: 'Gowun Batang', 'Nanum Myeongjo', 'AppleMyungjo', serif; font-weight: 700; }
        .font-body { font-family: 'Gowun Dodum', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif; }
        .font-body { font-family: 'Gowun Dodum', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif; }

        img {
            image-rendering: auto;
            transform: translateZ(0);
            backface-visibility: hidden;
            }
        @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeUp { from { opacity: .35; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .anim-fade-up { animation: fadeUp .35s ease-out; }
        @keyframes popIn { from { opacity: .2; transform: scale(.97) translateY(6px); } to { opacity: 1; transform: none; } }
        .anim-pop { animation: popIn .3s ease-out; }

        /* 오답 흔들림 */
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-9px); } 30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); } 60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
        }
        .anim-shake { animation: shake .45s cubic-bezier(.36,.07,.19,.97); }

        /* 정답 축하: 색종이 + 반짝임 */
        @keyframes confettiFall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--dx), 105vh, 0) rotate(var(--rot)); opacity: .1; }
        }
        .confetti-piece { position: absolute; top: -18px; animation: confettiFall var(--dur) var(--delay) cubic-bezier(.25,.6,.45,1) both; }
        @keyframes flashRing { 0% { transform: translate(-50%, -50%) scale(.2); opacity: .9; } 100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0; } }
        .flash-ring { animation: flashRing 1s ease-out both; }
        @keyframes twinkle { 0%, 100% { opacity: 0; transform: scale(.3) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(60deg); } }
        .twinkle { animation: twinkle 1.2s var(--delay) ease-in-out both; }
        @keyframes successGlow { 0% { box-shadow: 0 0 0 0 rgba(143,209,154,.55); } 100% { box-shadow: 0 0 0 14px rgba(143,209,154,0); } }
        .success-glow { animation: popIn .3s ease-out, successGlow 1.1s ease-out; }

        /* 엔딩 연출 */
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spinSlow 70s linear infinite; }
        .spin-rev { animation: spinSlow 110s linear infinite reverse; }
        @keyframes haloPulse { 0%, 100% { opacity: .75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.07); } }
        .halo-pulse { animation: haloPulse 4.5s ease-in-out infinite; }
        @keyframes relicIn { 0% { opacity: 0; transform: scale(.3); } 100% { opacity: 1; transform: scale(1); } }
        .relic-in { animation: relicIn .7s var(--delay) cubic-bezier(.2,.9,.3,1.3) both; }
        @keyframes relicGlow { 0%, 100% { box-shadow: 0 0 10px 1px rgba(226,184,92,.35); } 50% { box-shadow: 0 0 24px 6px rgba(226,184,92,.7); } }
        .relic-glow { animation: relicGlow 2.8s var(--delay) ease-in-out infinite; }
        @keyframes stampIn { 0% { opacity: 0; transform: scale(1.9); } 60% { opacity: 1; transform: scale(.9); } 100% { opacity: 1; transform: scale(1); } }
        .stamp-in { animation: stampIn .55s 1s cubic-bezier(.3,1.4,.5,1) both; }
        @keyframes smokeRise { 0% { opacity: 0; transform: translateY(0) scaleX(1); } 30% { opacity: .55; } 100% { opacity: 0; transform: translateY(-22px) scaleX(1.7); } }
        .smoke { animation: smokeRise 3.6s ease-out infinite; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes titleShine { from { background-position: 200% 50%; } to { background-position: -200% 50%; } }
        .title-shine {
          background: linear-gradient(100deg, #c8913a 20%, #fff3c4 45%, #e2b85c 55%, #c8913a 80%);
          background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: titleShine 6s linear infinite;
        }

        /* 비주얼 노벨 대화 · 획득 팝업 */
        @keyframes caretBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .type-caret { margin-left: 1px; animation: caretBlink .9s steps(1) infinite; }
        @keyframes portraitIn { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
        .portrait-in { animation: portraitIn .4s cubic-bezier(.2,.8,.3,1) both; }
        @keyframes nudgeRight { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
        .nudge-right { animation: nudgeRight 1s ease-in-out infinite; }

        /* 금동대향로 은은한 빛 · 금빛 광택 (연기는 SVG 애니메이션) */
        @keyframes censerGlow { 0%, 100% { opacity: .7; } 50% { opacity: 1; } }
        .censer-glow { animation: censerGlow 4s ease-in-out infinite; }
        @keyframes censerSheen { 0% { background-position: 160% 0; } 55%, 100% { background-position: -60% 0; } }
        .censer-sheen {
          background: linear-gradient(105deg, transparent 38%, rgba(255, 236, 170, .55) 50%, transparent 62%) no-repeat;
          background-size: 250% 100%; mix-blend-mode: screen; animation: censerSheen 6.5s ease-in-out infinite;
        }

        /* 말하는 입 뻐끔뻐끔 + 살짝 끄덕임 */
        .talk-mouth {
          position: absolute; aspect-ratio: 2 / 1.1; border-radius: 45% 45% 50% 50% / 35% 35% 65% 65%;
          background: radial-gradient(ellipse at 50% 85%, #c96457 0 28%, #6b1f18 60%, #2b0b08 100%);
          box-shadow: 0 0 0 .5px rgba(70, 25, 18, .5);
          transform: translate(-50%, -35%) scaleY(calc(var(--open, 0) * .8));
          opacity: min(1, calc(var(--open, 0) * 6));
        }
        /* 음성 없이 글자만 나올 때: 느긋하고 불규칙한 기본 움직임 */
        .is-flapping .talk-mouth { opacity: 1; animation: mouthFlap 1.5s linear infinite; }
        /* 턱을 내리는 방식 (학예연구사·뱃사공) */
        .talk-inner {
          position: absolute; transform: translateX(-50%);
          clip-path: ellipse(50% 100% at 50% 0%);
          background: radial-gradient(ellipse 60% 120% at 50% 0%, #1e0806 0 40%, #4a1410 70%, #7a3024 100%);
        }
        .talk-inner-curve { position: absolute; inset: 0; }
        .talk-jaw {
          position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill;
          transform: translateY(calc(var(--open, 0) * var(--drop)));
        }
        .is-flapping .talk-jaw { animation: jawFlap 1.5s linear infinite; }
        @keyframes jawFlap {
          0%, 50%, 100% { transform: translateY(calc(.08 * var(--drop))); }
          12% { transform: translateY(calc(.6 * var(--drop))); }
          24% { transform: translateY(calc(.18 * var(--drop))); }
          38% { transform: translateY(calc(.45 * var(--drop))); }
          63% { transform: translateY(calc(.65 * var(--drop))); }
          76% { transform: translateY(calc(.22 * var(--drop))); }
          88% { transform: translateY(calc(.5 * var(--drop))); }
        }
        @keyframes mouthFlap {
          0%   { transform: translate(-50%, -35%) scaleY(.08); }
          12%  { transform: translate(-50%, -35%) scaleY(.55); }
          24%  { transform: translate(-50%, -35%) scaleY(.15); }
          38%  { transform: translate(-50%, -35%) scaleY(.4); }
          50%  { transform: translate(-50%, -35%) scaleY(.08); }
          63%  { transform: translate(-50%, -35%) scaleY(.6); }
          76%  { transform: translate(-50%, -35%) scaleY(.2); }
          88%  { transform: translate(-50%, -35%) scaleY(.45); }
          100% { transform: translate(-50%, -35%) scaleY(.08); }
        }
        @keyframes talkBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        .talk-bob { animation: talkBob 1.6s ease-in-out infinite; }
        @keyframes rewardPop { 0% { opacity: 0; transform: scale(.6); } 60% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        .reward-pop { animation: rewardPop .55s cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes twinkleLoop { 0%, 100% { opacity: 0; transform: scale(.3) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(60deg); } }
        .twinkle-loop { animation: twinkleLoop 1.6s var(--delay) ease-in-out infinite both; }

        /* 금동이 각성(변신) */
        @keyframes beastOut {
          0%, 50% { opacity: 1; transform: scale(1); filter: brightness(1); }
          80% { opacity: 1; transform: scale(1.12); filter: brightness(2.4); }
          100% { opacity: 0; transform: scale(.4); filter: brightness(3); }
        }
        .morph-beast { animation: beastOut 2s .3s ease-in both; }
        @keyframes morphFlash { 0% { opacity: 0; transform: scale(.3); } 40% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(1.7); } }
        .morph-flash { opacity: 0; animation: morphFlash 1.1s 1.8s ease-out both; }
        @keyframes humanIn { 0% { opacity: 0; transform: translateY(14px) scale(.85); filter: brightness(2.6); } 100% { opacity: 1; transform: none; filter: none; } }
        .morph-human { animation: humanIn .9s 2.2s cubic-bezier(.2,.8,.3,1.1) both; }
        @keyframes auraGlow { 0%, 100% { box-shadow: 0 0 12px 2px rgba(246,220,148,.4); } 50% { box-shadow: 0 0 28px 8px rgba(246,220,148,.8); } }
        .aura-glow { animation: auraGlow 2.6s ease-in-out infinite; }
        @keyframes morphText { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .morph-text { animation: morphText .6s 2.6s ease-out both; }

        /* 엔딩 금동이 변신 전체 화면 (움직임 줄이기 설정과 상관없이 재생) */
        .aw-backdrop { background: radial-gradient(circle at 50% 45%, #3a280e, #080604 70%); }
        @keyframes awFade { from { opacity: 0; } to { opacity: 1; } }
        .aw-rays { transform: translate(-50%, -50%); animation: awSpin 14s linear infinite, awRaysIn 1s ease-out both; }
        .aw-rays.is-charging { animation: awSpin 3s linear infinite, awRaysIn 2.9s ease-in both; }
        @keyframes awSpin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes awRaysIn { from { opacity: 0; } to { opacity: .9; } }
        .aw-ring { width: 30vmin; height: 30vmin; margin: -15vmin 0 0 -15vmin; opacity: 0; box-shadow: 0 0 24px rgba(255,217,138,.6); animation: awRing 1.4s ease-in infinite; }
        @keyframes awRing { 0% { transform: scale(2.6); opacity: 0; } 30% { opacity: .9; } 100% { transform: scale(.3); opacity: 0; } }
        .aw-mote { opacity: 0; box-shadow: 0 0 10px 3px rgba(255,220,140,.8); animation: awMote 1.6s ease-in infinite; }
        @keyframes awMote { 0% { transform: translate(var(--sx), var(--sy)); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, -50%) scale(.3); opacity: 0; } }
        .aw-halo { animation: awHalo 2.9s ease-in both; }
        @keyframes awHalo { 0% { opacity: .2; transform: scale(.7); } 100% { opacity: 1; transform: scale(1.15); } }
        .aw-card-charge { animation: awCardIn .7s cubic-bezier(.2,.9,.3,1.2) both, awShake 2.2s .7s ease-in both; }
        @keyframes awCardIn { from { opacity: 0; transform: scale(.6) translateY(30px); } to { opacity: 1; transform: none; } }
        @keyframes awShake {
          0%, 30% { transform: none; }
          40% { transform: translateX(-2px) rotate(-.5deg); } 50% { transform: translateX(3px) rotate(.6deg); }
          60% { transform: translateX(-4px) rotate(-.8deg); } 70% { transform: translateX(5px) rotate(1deg); }
          80% { transform: translateX(-6px) rotate(-1.2deg) scale(1.03); } 90% { transform: translateX(6px) rotate(1.2deg) scale(1.06); }
          100% { transform: scale(1.1); }
        }
        .aw-beast { animation: awBeast 2.9s ease-in both; }
        @keyframes awBeast { 0%, 35% { filter: brightness(1); } 100% { filter: brightness(3.2) saturate(.4); } }
        .aw-flash { opacity: 0; animation: awFlash 1.3s 2.7s ease-out both; }
        @keyframes awFlash { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
        .aw-card-reveal { animation: awAura 2.6s ease-in-out infinite; }
        @keyframes awAura { 0%, 100% { box-shadow: 0 0 30px 6px rgba(246,220,148,.5); } 50% { box-shadow: 0 0 70px 18px rgba(246,220,148,.9); } }
        .aw-human { animation: awHuman 1.1s cubic-bezier(.2,.8,.3,1.1) both; }
        @keyframes awHuman { 0% { opacity: 0; transform: scale(1.18); filter: brightness(3); } 100% { opacity: 1; transform: none; filter: none; } }
        .aw-spark { opacity: 0; box-shadow: 0 0 12px 4px rgba(255,214,120,.85); animation: awSpark 1.3s ease-out both; }
        @keyframes awSpark { 0% { transform: translate(-50%, -50%) scale(1.4); opacity: 1; } 100% { transform: translate(var(--ex), var(--ey)) scale(.2); opacity: 0; } }
        .aw-title { animation: awTitle .8s .5s ease-out both; }
        @keyframes awTitle { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .aw-continue { animation: awFade .6s ease-out both; }

        @media (prefers-reduced-motion: reduce) {
          .morph-beast { display: none !important; }
          .morph-flash { opacity: 0 !important; }
          .morph-human, .aura-glow, .morph-text,
          .type-caret, .portrait-in, .nudge-right, .reward-pop, .twinkle-loop,
          .anim-fade-up, .anim-pop, .anim-shake, .success-glow, .spin-slow, .spin-rev, .halo-pulse,
          .relic-in, .relic-glow, .stamp-in, .smoke, .title-shine, [class*="animate-"] { animation: none !important; }
          .celebration { display: none !important; }
        }
      `}</style>
      {/* 은은한 배경 문양 */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 10%, #e2b85c 0, transparent 40%), radial-gradient(circle at 85% 90%, #4f8a7b 0, transparent 35%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* 유적지 사진 + 대체(Fallback) 화면 */
function StageImage({ src, alt, stageId, className = '', iconClassName = 'h-16 w-16', showPathHint = false, fit = 'cover' }) {
  const theme = THEME[stageId];
  const Icon = theme.icon;
  const [status, setStatus] = useState(src ? 'loading' : 'error'); // loading | loaded | error
  const imgRef = useRef(null);

  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
  }, [src]);

  // 캐시된 이미지는 onLoad 이전에 이미 로드되어 있을 수 있음
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) setStatus(img.naturalWidth > 0 ? 'loaded' : 'error');
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${theme.tone} ${className}`}>
      {/* 대체 화면: 사진이 없거나 실패해도 항상 아래에 깔려 있음 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 72% 28%, ${theme.accent}40, transparent 55%), radial-gradient(circle at 10% 100%, rgba(0,0,0,.5), transparent 60%), repeating-linear-gradient(135deg, rgba(255,255,255,.03) 0 2px, transparent 2px 16px)`,
        }}
      />
      <Icon
        className={`absolute right-[6%] top-1/2 -translate-y-1/2 opacity-25 ${iconClassName}`}
        style={{ color: theme.accent }}
        strokeWidth={0.9}
      />
      {/* fit=contain: 사진 전체를 보여 주고, 남는 양옆은 같은 사진을 흐리게 깔아 채움 */}
      {src && status !== 'error' && fit === 'contain' && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-75 transition-opacity duration-700 ${status === 'loaded' ? 'opacity-90' : 'opacity-0'}`}
        />
      )}
      {src && status !== 'error' && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${fit === 'contain' ? 'object-contain object-[68%_50%] drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : 'object-cover'} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {showPathHint && status === 'error' && (
        <span className="font-body absolute bottom-2 right-2 z-10 inline-flex max-w-[70%] items-center gap-1 truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-[#d9ccb0]">
          <Camera className="h-3 w-3 shrink-0" /> 사진 없음: {src || '경로 미지정'}
        </span>
      )}
    </div>
  );
}

/* 정답 축하 이펙트 (CSS 파티클) */
function Celebration({ big = false }) {
  const pieces = useMemo(() => {
    const colors = ['#e2b85c', '#f6dc94', '#fff3c4', '#8fd19a', '#e39bb4', '#7fb7c9'];
    const count = big ? 70 : 38;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
      rot: `${Math.round((Math.random() - 0.5) * 900)}deg`,
      dur: `${(1.5 + Math.random() * 1.1).toFixed(2)}s`,
      delay: `${(Math.random() * (big ? 0.6 : 0.25)).toFixed(2)}s`,
      w: 5 + Math.random() * 6,
      h: Math.random() > 0.5 ? 10 + Math.random() * 6 : 6,
      round: Math.random() > 0.65,
      color: colors[i % colors.length],
    }));
  }, [big]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: 50 + Math.cos((i / 8) * Math.PI * 2) * 22,
        top: 42 + Math.sin((i / 8) * Math.PI * 2) * 16,
        delay: `${(i * 0.06).toFixed(2)}s`,
      })),
    []
  );

  return (
    <div className="celebration pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      <span className="flash-ring absolute left-1/2 top-[42%] h-40 w-40 rounded-full border-2 border-[#f6dc94]/70" />
      {sparkles.map((s) => (
        <Sparkles
          key={s.id}
          className="twinkle absolute h-6 w-6 text-[#fff3c4]"
          style={{ left: `${s.left}%`, top: `${s.top}%`, '--delay': s.delay }}
        />
      ))}
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.round ? '9999px' : '2px',
            '--dx': p.dx,
            '--rot': p.rot,
            '--dur': p.dur,
            '--delay': p.delay,
          }}
        />
      ))}
    </div>
  );
}

/* 백제금동대향로 상징 일러스트 (SVG) */
/* 백제금동대향로: 실물 사진(국립중앙박물관, 공공누리 제1유형) + 향 연기 · 불씨 · 금빛 광택 연출
 * 연기는 사진 위 SVG(사진과 같은 457×1100 좌표)로, 실제 향처럼 가는 실연기가 곧게 오르다 위에서 천천히 일렁이며 사라집니다. */
const CENSER_PHOTO = 'images/censer.webp';
const CENSER_CREDIT = '사진: 국립중앙박물관 (공공누리 제1유형)';

function censerSmokeMarkup(uid) {
  const g = (n) => `${uid}-${n}`;
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  // 한 가닥의 모양: 구멍(x0,y0)에서 위로 H 만큼, 높이에 비례해 좌우로 흔들림
  const strand = (x0, y0, H, phase, amp) => {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const sway = Math.sin(phase + t * 3.4) * amp * t ** 1.25 + Math.sin(phase * 1.7 + t * 7.5) * amp * 0.35 * t ** 1.6;
      pts.push([x0 + sway, y0 - H * t]);
    }
    // 부드러운 곡선 (Catmull-Rom → 베지어)
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };

  // [x, y, 높이, 흔들림 폭, 굵기 배율, 진하기] — 봉황 머리 위 · 꼭대기 봉우리 사이 연기 구멍
  const vents = [
    [236, 26, 470, 120, 1.1, 0.55],
    [206, 230, 640, 150, 0.95, 0.42],
    [270, 232, 620, 140, 0.9, 0.38],
  ];

  const strands = vents
    .map(([x, y, H, amp, k, op], i) => {
      const ph = rnd() * 6.28;
      // 같은 구조의 모양 4개를 번갈아 → 천천히 일렁임
      const shapes = [0, 1.4, 2.9, 4.3].map((o) => strand(x, y, H, ph + o, amp));
      const values = [...shapes, shapes[0]].join(';');
      const dur = (11 + rnd() * 5).toFixed(1);
      const anim = `<animate attributeName="d" dur="${dur}s" repeatCount="indefinite" values="${values}" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1"/>`;
      return `
      <path d="${shapes[0]}" fill="none" stroke="#f4ead6" stroke-width="${(40 * k).toFixed(1)}" stroke-linecap="round" opacity="${(op * 0.3).toFixed(2)}" filter="url(#${g('haze')})" mask="url(#${g('spread')})">${anim}</path>
      <path d="${shapes[0]}" fill="none" stroke="#fbf4e6" stroke-width="${(5.5 * k).toFixed(1)}" stroke-linecap="round" opacity="${op}" filter="url(#${g('wisp')})">${anim}</path>`;
    })
    .join('');

  return `<svg viewBox="0 0 457 1100" width="100%" height="100%" style="overflow:visible" aria-hidden="true">
  <defs>
    <filter id="${g('wisp')}" x="-100%" y="-20%" width="300%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency=".006 .009" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="2.8"/>
    </filter>
    <filter id="${g('haze')}" x="-100%" y="-20%" width="300%" height="140%">
      <feGaussianBlur stdDeviation="20"/>
    </filter>
    <linearGradient id="${g('fadeG')}" gradientUnits="userSpaceOnUse" x1="0" y1="-380" x2="0" y2="240">
      <stop offset="0" stop-color="#000"/>
      <stop offset=".3" stop-color="#3a3a3a"/>
      <stop offset=".62" stop-color="#c8c8c8"/>
      <stop offset=".9" stop-color="#fff"/>
      <stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <linearGradient id="${g('spreadG')}" gradientUnits="userSpaceOnUse" x1="0" y1="-400" x2="0" y2="200">
      <stop offset="0" stop-color="#000"/><stop offset=".45" stop-color="#fff"/><stop offset=".85" stop-color="#555"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="${g('spread')}" maskUnits="userSpaceOnUse" x="-300" y="-700" width="1057" height="1000">
      <rect x="-300" y="-700" width="1057" height="1000" fill="url(#${g('spreadG')})"/>
    </mask>
    <mask id="${g('fade')}" maskUnits="userSpaceOnUse" x="-300" y="-700" width="1057" height="1000">
      <rect x="-300" y="-700" width="1057" height="1000" fill="url(#${g('fadeG')})"/>
    </mask>
  </defs>
  <g class="censer-smoke" mask="url(#${g('fade')})" style="mix-blend-mode:screen">${strands}</g>
</svg>`;
}

function CenserIllustration({ className = '', smoke = true }) {
  const uid = useMemo(() => `c${Math.random().toString(36).slice(2, 8)}`, []);
  const smokeMarkup = useMemo(() => (smoke ? censerSmokeMarkup(uid) : ''), [uid, smoke]);
  return (
    <div className={`relative ${className}`} role="img" aria-label="백제금동대향로">
      {/* 사진 영역: 아래쪽에 붙이고, 위쪽 여백은 연기가 피어오르는 공간 */}
      <div className="absolute bottom-0 left-1/2 h-[84%] -translate-x-1/2" style={{ aspectRatio: '457 / 1100' }}>
        <div className="censer-glow pointer-events-none absolute -inset-x-[70%] -top-[8%] bottom-[30%] rounded-full bg-[radial-gradient(closest-side,rgba(255,214,130,0.4),rgba(226,184,92,0.12)_55%,transparent)]" />
        {smoke && <div className="pointer-events-none absolute inset-0" dangerouslySetInnerHTML={{ __html: smokeMarkup }} />}
        <img src={CENSER_PHOTO} alt="" draggable="false" className="relative h-full w-full select-none object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]" />
        {/* 금빛 광택이 천천히 훑고 지나감 (향로 모양으로만) */}
        <div
          className="censer-sheen pointer-events-none absolute inset-0"
          style={{
            WebkitMaskImage: `url(${CENSER_PHOTO})`,
            maskImage: `url(${CENSER_PHOTO})`,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
          }}
        />
      </div>
    </div>
  );
}

/* 수료증 도장 (SVG) */
function SealStamp({ className = '' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="부여 수사본부 직인">
      <g fill="none" stroke="#c0392b" opacity="0.88">
        <circle cx="50" cy="50" r="45" strokeWidth="4" />
        <circle cx="50" cy="50" r="38" strokeWidth="1.5" />
      </g>
      <g fill="#c0392b" opacity="0.88" className="font-display" textAnchor="middle">
        <text x="50" y="47" fontSize="19" fontWeight="700">扶餘</text>
        <text x="50" y="68" fontSize="13" fontWeight="700">수사본부</text>
        <text x="50" y="27" fontSize="7" letterSpacing="1">★ 時間探偵 ★</text>
      </g>
    </svg>
  );
}

/* 엔딩: 향로 복원 + 유물 원형 배치 + 수료증 */
function EndingScreen({ inventory, completedAt, mistakeCount, hintCount, onOpenNotebook, onRestart, onReplayAwakening }) {
  const dateText = formatDate(completedAt || new Date());
  const relics = STAGES.map((s, i) => {
    const angle = -90 + (360 / STAGES.length) * i;
    const rad = (angle * Math.PI) / 180;
    return {
      stage: s,
      owned: inventory.some((it) => it.stageId === s.id),
      x: 50 + Math.cos(rad) * 39,
      y: 50 + Math.sin(rad) * 39,
      delay: `${(0.25 + i * 0.14).toFixed(2)}s`,
    };
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-14 pt-8 text-center">
      <p className="font-body inline-flex items-center gap-1.5 rounded-full border border-[#e2b85c]/40 bg-[#e2b85c]/10 px-3 py-1 text-xs tracking-[0.2em] text-[#e2b85c]">
        <Sparkles className="h-3.5 w-3.5" /> 일곱 봉인 회수 완료
      </p>

      {/* 금동이 각성(변신) 연출 */}
      <div className="mt-10 w-full">
        <AwakeningCard onReplay={onReplayAwakening} />
      </div>

      {/* 향로 + 후광 + 유물 원형 배치 */}
      <div className="relative mt-4 aspect-square w-full max-w-[440px]">
        <div className="halo-pulse absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(246,220,148,0.55)_0%,rgba(226,184,92,0.22)_38%,transparent_68%)]" />
        <div
          className="spin-slow absolute inset-[12%] rounded-full opacity-60"
          style={{
            background:
              'repeating-conic-gradient(from 0deg, rgba(246,220,148,.22) 0deg 4deg, transparent 4deg 15deg)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 30%, #000 45%, transparent 72%)',
            maskImage: 'radial-gradient(circle, transparent 30%, #000 45%, transparent 72%)',
          }}
        />
        <div className="spin-rev absolute inset-[11%] rounded-full border border-dashed border-[#e2b85c]/35" />
        <div className="absolute inset-[3%] rounded-full border border-[#e2b85c]/10" />

        <div className="absolute left-1/2 top-[40%] h-[66%] w-[31%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_28px_rgba(246,220,148,0.55)]">
          <CenserIllustration className="h-full w-full" />
        </div>

        {relics.map(({ stage: s, owned, x, y, delay }) => {
          return (
            <div
              key={s.id}
              className="absolute w-[76px] -translate-x-1/2 -translate-y-1/2 sm:w-[92px]"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="relic-in flex flex-col items-center gap-1" style={{ '--delay': delay }}>
                <span className={`block h-11 w-11 rounded-full sm:h-14 sm:w-14 ${owned ? 'relic-glow' : 'opacity-60'}`} style={{ '--delay': delay }}>
                  <RewardImage
                    stage={s}
                    owned={owned}
                    rounded="rounded-full"
                    className="h-full w-full border border-[#f6dc94]/80"
                    iconClassName="h-5 w-5 sm:h-6 sm:w-6"
                  />
                </span>
                <span className="font-body w-full truncate text-[10px] leading-tight text-[#f3e7c9] sm:text-xs">{s.rewardItem.shortName}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="font-body -mt-2 mb-2 text-[11px] text-[#6f6350]">{CENSER_CREDIT}</p>

      <h2 className="font-display title-shine mt-2 text-3xl leading-tight sm:text-5xl" style={{ textWrap: 'balance' }}>
        백제금동대향로 완전 복원!
      </h2>
      <p className="font-body mt-3 max-w-md text-[15px] leading-7 text-[#d9ccb0]">
        일곱 유적지에서 되찾은 봉인이 향로로 돌아왔습니다. 봉황이 다시 날개를 펼치고, 향로에서 은은한 향이 피어오릅니다.
      </p>

      <div className="mt-10 flex w-full max-w-xl flex-col gap-6">
        <EndingLine
          speaker={HERO_NAME}
          role="각성한 인간 수사관"
          isPlayer
          text="봉인이 모두 돌아오니 힘이 넘쳐요! 이제 정령이 아니라 진짜 수사관으로서 부여의 시간을 지킬게요."
        />
        <EndingLine
          speaker="학예연구사"
          role="국립부여박물관 학예연구사"
          avatar="./images/characters/curator.png"
          text="수사관님 덕분에 향로가 제자리를 찾았어요. 봉황이 다시 날개를 펼쳤으니, 부여의 시간도 다시 흐르기 시작할 거예요."
        />
      </div>

      {/* 되찾은 일곱 봉인 카드 */}
      <section className="mt-10 w-full max-w-2xl">
        <h3 className="font-display text-xl text-[#f3e7c9] sm:text-2xl">되찾은 일곱 봉인</h3>
        <ul className="mt-4 flex flex-wrap justify-center gap-3">
          {STAGES.map((s) => {
            const owned = inventory.some((it) => it.stageId === s.id);
            return (
              <li key={s.id} className="w-[calc(50%-6px)] sm:w-[calc(25%-9px)]">
                <div
                  className={`font-body flex h-full flex-col items-center gap-2 rounded-2xl border p-3 ${owned ? 'border-[#e2b85c]/40 bg-gradient-to-b from-[#2a2112] to-[#1a1510]' : 'border-dashed border-[#3a2f20]'
                    }`}
                >
                  <RewardImage stage={s} owned={owned} className="aspect-square w-full max-w-[120px] border border-[#4a3b26]" iconClassName="h-10 w-10" />
                  <span className="text-[11px] text-[#9c8c6e] tabular-nums">
                    {String(s.order).padStart(2, '0')} · {s.name}
                  </span>
                  <span className={`text-sm font-bold leading-tight ${owned ? 'text-[#f3e7c9]' : 'text-[#5f5442]'}`}>
                    {owned ? s.rewardItem.name : '미회수 봉인'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 수료증 */}
      <section className="relative mt-8 w-full max-w-xl rounded-[28px] bg-gradient-to-br from-[#e2b85c] via-[#8a5f25] to-[#e2b85c] p-[2px] shadow-2xl shadow-black/60">
        <div className="relative overflow-hidden rounded-[26px] bg-[#f3e9d2] px-5 pb-6 pt-7 text-left text-[#3a2a17] sm:px-9 sm:pb-8 sm:pt-9">
          <div className="pointer-events-none absolute inset-2.5 rounded-[20px] border border-[#b0813a]/60" />
          <div className="pointer-events-none absolute inset-4 rounded-[16px] border border-dashed border-[#b0813a]/40" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, #8a5f25 0 1px, transparent 1px 9px)' }}
          />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 text-[#8a5f25]">
              <Award className="h-5 w-5" />
              <span className="font-body text-[11px] tracking-[0.35em]">CERTIFICATE · 수 료 증</span>
            </div>
            <h3 className="font-display mt-2 text-center text-2xl text-[#3a2a17] sm:text-3xl">명예 부여 역사 수사관</h3>

            <div className="mt-5 flex items-start gap-4">
              <dl className="font-body grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm sm:gap-x-4 sm:text-[15px]">
                <dt className="text-[#8a6a3c]">수사관 이름</dt>
                <dd className="font-display font-bold text-[#2a1d0e]">부여 시간 탐정</dd>
                <dt className="text-[#8a6a3c]">해결 날짜</dt>
                <dd className="flex items-center gap-1.5 font-bold text-[#2a1d0e] tabular-nums">
                  <Calendar className="h-4 w-4 text-[#8a6a3c]" /> {dateText}
                </dd>
                <dt className="text-[#8a6a3c]">회수한 봉인</dt>
                <dd className="font-bold text-[#2a1d0e] tabular-nums">
                  {inventory.length} / {TOTAL}
                </dd>
                <dt className="text-[#8a6a3c]">수사 기록</dt>
                <dd className="text-[#2a1d0e] tabular-nums">
                  오답 {mistakeCount}회 · 힌트 {hintCount}회
                </dd>
              </dl>
              <figure className="shrink-0 text-center">
                <div className="aura-glow h-24 w-[72px] overflow-hidden rounded-md border-2 border-[#b0813a] sm:h-36 sm:w-28">
                  <HeroAvatar mode="human" crop className="h-full w-full" />
                </div>
                <figcaption className="font-display mt-1 text-xs text-[#5a4426]">{HERO_NAME}</figcaption>
              </figure>
            </div>

            <p className="font-body mt-5 border-t border-[#b0813a]/40 pt-4 pr-24 text-[13px] leading-6 text-[#4a3820] sm:pr-28 sm:text-sm">
              위 수사관은 부여 일곱 유적지를 탐방하여 백제금동대향로의 봉인을 모두 되찾았기에, 그 공로를 기려 이 증서를 수여합니다.
            </p>
            <p className="font-display mt-3 pr-24 text-sm text-[#3a2a17] sm:pr-28">국립부여박물관 특별수사본부</p>

            <div className="absolute -bottom-3 right-0 h-24 w-24 -rotate-12 sm:h-28 sm:w-28">
              <SealStamp className="stamp-in h-full w-full" />
            </div>
          </div>
        </div>
      </section>

      <div className="font-body mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={onOpenNotebook}
          className="inline-flex items-center gap-2 rounded-full bg-[#e2b85c] px-6 py-3 font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40"
        >
          <BookOpen className="h-4 w-4" /> 탐정 수첩 보기
        </button>
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-full border border-[#e2b85c]/60 px-6 py-3 text-[#e2b85c] transition hover:bg-[#e2b85c]/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/30"
        >
          <RotateCcw className="h-4 w-4" /> 처음부터 다시
        </button>
      </div>
    </div>
  );
}

/* 이미지 공통 처리: 로딩 전·실패·경로 없음일 때 fallback 을 보여줌 */
function SmartImage({ src, alt, className = '', imgClassName = '', background = null, fallback = null }) {
  const [status, setStatus] = useState(src ? 'loading' : 'error'); // loading | loaded | error
  const imgRef = useRef(null);

  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) setStatus(img.naturalWidth > 0 ? 'loaded' : 'error');
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {background}
      {status !== 'loaded' && fallback}
      {src && status !== 'error' && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${imgClassName} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

/* 보상 아이템 이미지 (미획득이면 자물쇠 실루엣) */
function RewardImage({ stage, owned = true, className = '', rounded = 'rounded-xl', iconClassName = 'h-8 w-8' }) {
  const Icon = ITEM_ICON[stage.id] || THEME[stage.id].icon;
  if (!owned) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden border-dashed bg-[#15110d] ${rounded} ${className}`}>
        <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.04),transparent_70%)]" />
        <Lock className={`relative text-[#4f4535] ${iconClassName}`} />
      </div>
    );
  }
  return (
    <SmartImage
      src={stage.rewardItem.image}
      alt={stage.rewardItem.name}
      className={`${rounded} ${className}`}
      imgClassName="object-contain p-[8%] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
      background={
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,#4a3718,#1a140c_72%)]">
          <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(246,220,148,0.32),rgba(226,184,92,0.08)_60%,transparent_72%)]" />
        </div>
      }
      fallback={
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-[16%] rounded-full border border-[#e2b85c]/35" />
          <Icon className={`relative text-[#f6dc94] drop-shadow-[0_0_8px_rgba(246,220,148,0.6)] ${iconClassName}`} strokeWidth={1.4} />
        </div>
      }
    />
  );
}

/* 캐릭터 초상화 대체 그림 (이미지가 없을 때) */
function PortraitSilhouette({ tone, variant }) {
  if (variant === 'beast') {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,211,77,.45), transparent 65%), linear-gradient(180deg, #2f2410, #15110a)' }}>
        <HeroBeastArt className="h-[86%] w-[86%]" />
      </div>
    );
  }
  if (variant === 'human') {
    return (
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(246,220,148,.4), transparent 62%), linear-gradient(180deg, #2a2112, #120f0c)' }}>
        <HeroHumanArt crop className="absolute inset-0 h-full w-full" />
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0"
      style={{ background: `radial-gradient(circle at 50% 32%, ${tone}38, transparent 62%), linear-gradient(180deg, #241c14, #120f0c)` }}
    >
      <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[86%] w-full" aria-hidden="true">
        <g fill={tone}>
          <circle cx="50" cy="50" r="18" opacity="0.38" />
          <path d="M12 130 C12 98 29 78 50 78 C71 78 88 98 88 130Z" opacity="0.32" />
        </g>
      </svg>
    </div>
  );
}

const PORTRAIT_TONE = { beast: '#ffd34d', human: '#f6dc94' };

function CharacterPortrait({ src, name, variant = 'npc', accent, className = '', talking = false }) {
  const tone = PORTRAIT_TONE[variant] || accent;
  const mouth = mouthOf(src);
  const jaw = useMemo(() => (mouth && mouth.jaw ? jawShapes(mouth) : null), [mouth]);
  const mouthRef = useRef(null);

  useEffect(() => {
    const el = mouthRef.current; // 이미지와 같은 3:4 상자 (자식들이 --open 값을 물려받음)
    if (!talking || !el) return undefined;
    let raf = 0;
    let open = 0;
    const tick = () => {
      const lv = VoicePlayer.level();
      if (lv == null) {
        el.classList.add('is-flapping');
      } else {
        el.classList.remove('is-flapping');
        // 소리가 커질 땐 빨리 열고, 작아질 땐 천천히 닫아서 자연스럽게
        open += (lv - open) * (lv > open ? 0.45 : 0.18);
        el.style.setProperty('--open', (open < 0.06 ? 0 : open).toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      el.classList.remove('is-flapping');
      el.style.setProperty('--open', '0');
    };
  }, [talking]);
  return (
    <div className={`portrait-in ${className}`}>
      <div
        className={`relative h-full w-full rounded-2xl p-[2px] shadow-[0_14px_30px_-10px_rgba(0,0,0,0.8)] ${variant === 'human' ? 'aura-glow' : ''}`}
        style={{ background: `linear-gradient(160deg, ${tone}, #3a2a17 55%, ${tone}99)` }}
      >
        <div className={`relative h-full w-full ${talking ? 'talk-bob' : ''}`}>
          <SmartImage
            src={src}
            alt={`${name} 캐릭터`}
            className="h-full w-full rounded-[14px] bg-[#120f0c]"
            imgClassName="object-cover object-top"
            fallback={<PortraitSilhouette tone={tone} variant={variant} />}
          />
          {/* 말하는 입: 이미지(3:4)와 같은 비율의 상자를 위쪽 기준으로 겹쳐 입 위치를 맞춤 */}
          {mouth && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]" aria-hidden="true">
              <div ref={mouthRef} className="absolute left-1/2 top-0 h-full -translate-x-1/2" style={{ aspectRatio: '3 / 4' }}>
                {mouth.jaw ? (
                  <>
                    {/* 벌어진 입 안쪽 (턱이 내려가야 보임) */}
                    {jaw.innerClip ? (
                      <span
                        className="talk-inner-curve"
                        style={{
                          clipPath: jaw.innerClip,
                          background: `radial-gradient(ellipse ${mouth.w / 2}% 3% at ${mouth.x}% ${mouth.y}%, #1e0806 35%, #4a1410 70%, #7a3024 100%)`,
                        }}
                      />
                    ) : (
                      <span
                        className="talk-inner"
                        style={{ left: `${mouth.x}%`, top: `${mouth.y}%`, width: `${mouth.w}%`, height: `${mouth.jaw.drop * 1.7}%` }}
                      />
                    )}
                    {/* 아랫입술~턱: 같은 그림을 겹쳐 그 부분만 아래로 살짝 이동 */}
                    <img
                      src={src}
                      alt=""
                      draggable="false"
                      className="talk-jaw"
                      style={{
                        '--drop': `${mouth.jaw.drop}%`,
                        clipPath: jaw.jawClip,
                        WebkitMaskImage: `radial-gradient(ellipse ${mouth.jaw.w / 2}% ${mouth.jaw.h}% at ${mouth.x}% ${mouth.y}%, #000 62%, transparent 100%)`,
                        maskImage: `radial-gradient(ellipse ${mouth.jaw.w / 2}% ${mouth.jaw.h}% at ${mouth.x}% ${mouth.y}%, #000 62%, transparent 100%)`,
                      }}
                    />
                  </>
                ) : (
                  <span className="talk-mouth" style={{ left: `${mouth.x}%`, top: `${mouth.y}%`, width: `${mouth.w}%` }} />
                )}
              </div>
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-[2px] bottom-[2px] h-1/3 rounded-b-[14px] bg-gradient-to-t from-black/55 to-transparent" />
      </div>
    </div>
  );
}

/* ===================== 주인공 금동이 (정령형 / 인간형) ===================== */

/* 정령(동물) 모드 기본 그림: 노란 아기 봉황 */
function HeroBeastArt({ className = '' }) {
  const uid = useMemo(() => `hb${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="정령 모습의 금동이">
      <defs>
        <radialGradient id={`${uid}-body`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.55" stopColor="#ffd34d" />
          <stop offset="1" stopColor="#e39a17" />
        </radialGradient>
        <radialGradient id={`${uid}-pearl`} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9fd0c3" />
        </radialGradient>
      </defs>
      {/* 볏(불꽃 깃) */}
      <path d="M50 12 C45 20 44 26 48 33 C50 26 54 22 50 12Z" fill="#ff9f43" />
      <path d="M41 19 C38 26 39 31 44 35 C43 29 44 24 41 19Z" fill="#ffb84d" />
      <path d="M59 19 C62 26 61 31 56 35 C57 29 56 24 59 19Z" fill="#ffb84d" />
      {/* 꼬리 깃 */}
      <path d="M38 80 C30 90 24 92 18 90 C26 86 30 80 34 74Z" fill="#ffb84d" />
      <path d="M62 80 C70 90 76 92 82 90 C74 86 70 80 66 74Z" fill="#ffb84d" />
      {/* 날개 */}
      <path d="M24 56 C12 50 9 40 14 33 C19 43 27 47 33 50Z" fill="#ffc93c" />
      <path d="M76 56 C88 50 91 40 86 33 C81 43 73 47 67 50Z" fill="#ffc93c" />
      {/* 몸 */}
      <ellipse cx="50" cy="58" rx="28" ry="26" fill={`url(#${uid}-body)`} />
      <ellipse cx="50" cy="67" rx="16" ry="12" fill="#fff6cf" />
      {/* 눈 · 볼 · 부리 */}
      <ellipse cx="40" cy="54" rx="4.4" ry="5.4" fill="#3a2410" />
      <ellipse cx="60" cy="54" rx="4.4" ry="5.4" fill="#3a2410" />
      <circle cx="41.5" cy="52.2" r="1.6" fill="#fff" />
      <circle cx="61.5" cy="52.2" r="1.6" fill="#fff" />
      <ellipse cx="32.5" cy="62" rx="4" ry="2.4" fill="#ff8a80" opacity="0.65" />
      <ellipse cx="67.5" cy="62" rx="4" ry="2.4" fill="#ff8a80" opacity="0.65" />
      <path d="M46.5 60 L53.5 60 L50 64.5Z" fill="#f08c2a" />
      {/* 품에 안은 여의주 */}
      <circle cx="50" cy="80" r="5" fill={`url(#${uid}-pearl)`} stroke="#e2b85c" strokeWidth="1" />
    </svg>
  );
}

/* 인간 모드 기본 그림: 왕관을 쓴 소년 탐정 실루엣 (crop=true 면 상반신 위주) */
function HeroHumanArt({ className = '', crop = false }) {
  const uid = useMemo(() => `hh${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg
      viewBox="0 0 100 160"
      preserveAspectRatio={crop ? 'xMidYMin slice' : 'xMidYMax meet'}
      className={className}
      role="img"
      aria-label="인간 수사관 모습의 금동이"
    >
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0bd" />
          <stop offset="0.5" stopColor="#e2b85c" />
          <stop offset="1" stopColor="#a8742c" />
        </linearGradient>
        <linearGradient id={`${uid}-coat`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4426" />
          <stop offset="1" stopColor="#241a10" />
        </linearGradient>
      </defs>
      {/* 망토 자락 */}
      <path d="M29 56 C17 72 13 96 16 118 C23 104 26 86 33 70Z" fill="#8a2f22" />
      <path d="M71 56 C83 72 87 96 84 118 C77 104 74 86 67 70Z" fill="#8a2f22" />
      {/* 코트 */}
      <path
        d="M28 56 C32 49 41 47 50 47 C59 47 68 49 72 56 L79 104 L66 106 L64 152 L54 152 L50 110 L46 152 L36 152 L34 106 L21 104 Z"
        fill={`url(#${uid}-coat)`}
        stroke={`url(#${uid}-gold)`}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M50 49 L43 66 L50 80 L57 66 Z" fill="#17110a" stroke={`url(#${uid}-gold)`} strokeWidth="1" />
      <rect x="31" y="86" width="38" height="4" rx="1" fill={`url(#${uid}-gold)`} />
      <circle cx="50" cy="96" r="1.6" fill="#e2b85c" />
      <circle cx="50" cy="102" r="1.6" fill="#e2b85c" />
      {/* 목 · 얼굴 */}
      <rect x="46" y="42" width="8" height="7" fill="#3b2c1a" />
      <circle cx="50" cy="33" r="11.5" fill="#3b2c1a" stroke={`url(#${uid}-gold)`} strokeWidth="1.3" />
      {/* 왕관 */}
      <path d="M37 21 L39 8 L44.5 14.5 L50 4 L55.5 14.5 L61 8 L63 21 Z" fill={`url(#${uid}-gold)`} />
      <rect x="36.5" y="19.5" width="27" height="4.5" rx="1.5" fill={`url(#${uid}-gold)`} />
      <circle cx="50" cy="12.5" r="1.8" fill="#c0392b" />
      <circle cx="42" cy="21.7" r="1.1" fill="#9fd0c3" />
      <circle cx="58" cy="21.7" r="1.1" fill="#9fd0c3" />
    </svg>
  );
}

/* 주인공 이미지 (실제 파일이 없으면 위 기본 그림) */
function HeroAvatar({ mode, crop = false, className = '' }) {
  const isHuman = mode === 'human';
  return (
    <SmartImage
      src={isHuman ? HERO_AVATAR_HUMAN : HERO_AVATAR_BEAST}
      alt={isHuman ? '금동이 (인간 수사관)' : '금동이 (정령)'}
      className={className}
      imgClassName={crop ? 'object-cover object-top' : 'object-contain object-bottom'}
      background={
        <div
          className="absolute inset-0"
          style={{
            background: isHuman
              ? 'radial-gradient(circle at 50% 30%, rgba(246,220,148,.4), transparent 62%), linear-gradient(180deg, #2a2112, #120f0c)'
              : 'radial-gradient(circle at 50% 45%, rgba(255,211,77,.45), transparent 62%), linear-gradient(180deg, #2f2410, #15110a)',
          }}
        />
      }
      fallback={
        isHuman ? (
          <HeroHumanArt crop={crop} className={`absolute inset-x-0 bottom-0 w-full ${crop ? 'h-full' : 'h-[94%]'}`} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <HeroBeastArt className={crop ? 'h-[92%] w-[92%]' : 'h-[72%] w-[72%]'} />
          </div>
        )
      }
    />
  );
}

/* 엔딩: 정령 → 인간 각성 변신 카드 */
function AwakeningCard({ onReplay }) {
  const [run, setRun] = useState(0);
  return (
    <section className="w-full max-w-2xl" aria-label="금동이 각성">
      <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,250px)_minmax(0,1fr)] sm:gap-8">
        <div key={run} className="relative mx-auto aspect-[3/4] w-full max-w-[250px]">
          <div className="halo-pulse absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(246,220,148,0.5),transparent_65%)]" />
          <div
            className="spin-slow absolute -inset-10 rounded-full opacity-70"
            style={{
              background: 'repeating-conic-gradient(from 0deg, rgba(246,220,148,.25) 0deg 5deg, transparent 5deg 16deg)',
              WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
              maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
            }}
          />
          <div className="aura-glow relative h-full w-full rounded-3xl bg-gradient-to-br from-[#fff0bd] via-[#b6852f] to-[#f6dc94] p-[2px]">
            <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-[#120f0c]">
              <div className="morph-human absolute inset-0">
                <HeroAvatar mode="human" className="h-full w-full" />
              </div>
              <div className="morph-beast absolute inset-0">
                <HeroAvatar mode="beast" className="h-full w-full" />
              </div>
              <div className="morph-flash pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#ffffff_0%,rgba(255,240,189,0.9)_30%,rgba(226,184,92,0.4)_60%,transparent_75%)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="font-body absolute inset-x-0 bottom-3 text-center text-xs tracking-[0.2em] text-[#f6dc94]">금동이 · 각성 완료</span>
            </div>
          </div>
        </div>

        <div className="text-center sm:text-left">
          <p className="font-body text-xs tracking-[0.3em] text-[#c9a96b]">AWAKENING</p>
          <h3 className="font-display title-shine mt-2 text-2xl leading-tight sm:text-3xl" style={{ textWrap: 'balance' }}>
            금동이, 본래 모습을 되찾다
          </h3>
          <p className="morph-text font-body mt-3 text-[15px] leading-7 text-[#ece0c4] sm:text-base">
            일곱 봉인의 기운이 하나로 모여 금동이가 본래의 늠름한 인간 수사관 모습으로 각성했습니다!
          </p>
          <button
            onClick={() => (onReplay ? onReplay() : setRun((r) => r + 1))}
            className="font-body mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#e2b85c]/50 px-4 py-2 text-sm text-[#e2b85c] transition hover:bg-[#e2b85c]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60"
          >
            <RotateCcw className="h-4 w-4" /> 변신 다시 보기
          </button>
        </div>
      </div>
    </section>
  );
}

/* 시작 화면 나레이션: 화면이 열리면 소개 글을 읽어 줌.
 * 브라우저가 첫 터치 전 소리를 막으면, 버튼이 아닌 곳을 처음 누를 때 읽기 시작. 오른쪽 위에서 다시 듣기 가능. */
function IntroNarration({ voiceOn, children }) {
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const profile = VOICE[NARRATOR];

  const play = () => {
    setBlocked(false);
    VoicePlayer.play(voiceFile(profile.id, INTRO_NARRATION), {
      rate: profile.playbackRate || 1,
      onStart: () => setPlaying(true),
      onEnd: () => setPlaying(false),
      onBlocked: () => setBlocked(true),
    });
  };

  useEffect(() => {
    if (!voiceOn) return undefined;
    const t = setTimeout(play, 600); // 화면이 뜬 뒤 살짝 쉬었다가
    return () => {
      clearTimeout(t);
      VoicePlayer.stop();
    };
  }, [voiceOn]);

  // 자동 재생이 막혔으면: 버튼이 아닌 곳을 처음 누를 때 읽기 시작
  useEffect(() => {
    if (!blocked || !voiceOn) return undefined;
    const onTap = (e) => {
      if (e.target.closest && e.target.closest('button')) return;
      Sound.unlock();
      play();
    };
    document.addEventListener('pointerdown', onTap, { once: true });
    return () => document.removeEventListener('pointerdown', onTap);
  }, [blocked, voiceOn]);

  return (
    <>
      {children}
      {voiceOn && (
        <button
          onClick={() => {
            Sound.unlock();
            if (playing) VoicePlayer.stop();
            else play();
            if (playing) setPlaying(false);
          }}
          className="font-body fixed right-4 top-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-[#5a4a32] bg-[#1d1813]/90 px-3.5 py-2 text-xs text-[#e8dcc0] backdrop-blur transition hover:border-[#e2b85c] hover:text-[#f6ecd2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60"
        >
          <SpeechIcon className="h-4 w-4 text-[#e2b85c]" />
          {playing ? '나레이션 멈추기' : blocked ? '화면을 누르면 이야기가 시작돼요' : '이야기 다시 듣기'}
        </button>
      )}
    </>
  );
}

/* 엔딩: 금동이 변신 전체 화면 연출 (약 6초)
 * 정령 등장 → 기운이 모이며 빛 고리·빛살·빛 알갱이가 빨려 듦 → 번쩍 → 인간 수사관으로 각성, 불꽃이 터짐 → 제목 */
function AwakeningOverlay({ sfxOn, onDone }) {
  const [phase, setPhase] = useState('charge'); // charge → reveal → done(계속하기 버튼)
  useEffect(() => {
    if (sfxOn) Sound.awaken();
    const t1 = setTimeout(() => setPhase('reveal'), 2900);
    const t2 = setTimeout(() => setPhase('done'), 4600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sfxOn]);

  // 모여드는 빛 알갱이 · 터지는 불꽃 (위치 고정)
  const motes = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + (i % 3) * 0.4;
        const r = 46 + (i % 5) * 6;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r, d: (0.5 + (i % 7) * 0.3).toFixed(2), s: 4 + (i % 4) * 2 };
      }),
    [],
  );
  const sparks = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        const r = 30 + (i % 6) * 8;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r, d: ((i % 5) * 0.05).toFixed(2), s: 3 + (i % 3) * 3 };
      }),
    [],
  );
  const charging = phase === 'charge';

  return (
    <div className="aw-backdrop fixed inset-0 z-[70] flex items-center justify-center overflow-hidden" role="dialog" aria-modal="true" aria-label="금동이 각성">
      {/* 빛살 */}
      <div
        className={`aw-rays pointer-events-none absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] ${charging ? 'is-charging' : ''}`}
        style={{
          background: 'repeating-conic-gradient(from 0deg, rgba(255,226,150,.28) 0deg 4deg, transparent 4deg 13deg)',
          WebkitMaskImage: 'radial-gradient(circle, #000 8%, transparent 52%)',
          maskImage: 'radial-gradient(circle, #000 8%, transparent 52%)',
        }}
      />
      {/* 안쪽으로 모이는 빛 고리 */}
      {charging &&
        [0, 0.7, 1.4].map((d) => (
          <span
            key={d}
            className="aw-ring pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2 border-[#ffd98a]"
            style={{ animationDelay: `${0.5 + d}s` }}
          />
        ))}
      {/* 모여드는 빛 알갱이 */}
      {charging &&
        motes.map((m, i) => (
          <span
            key={i}
            className="aw-mote pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-[#fff1c4]"
            style={{ width: m.s, height: m.s, '--sx': `${m.x}vmin`, '--sy': `${m.y}vmin`, animationDelay: `${m.d}s` }}
          />
        ))}

      {/* 금동이 카드 */}
      {/* 정령일 땐 3:4, 각성하면 전신 비율(2:3)로 길어짐 (번쩍이는 순간 바뀜) */}
      <div className={`relative ${charging ? 'aspect-[3/4] h-[min(58vh,520px)]' : 'aspect-[687/1024] h-[min(64vh,620px)]'}`}>
        <div className="aw-halo pointer-events-none absolute -inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(255,224,150,0.65),rgba(226,184,92,0.2)_40%,transparent_68%)]" />
        <div
          className={`relative h-full w-full rounded-[28px] bg-gradient-to-br from-[#fff0bd] via-[#b6852f] to-[#f6dc94] p-[3px] ${charging ? 'aw-card-charge' : 'aw-card-reveal'}`}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[25px] bg-[#120f0c]">
            {charging ? (
              <div className="aw-beast absolute inset-0">
                <HeroAvatar mode="beast" className="h-full w-full" />
              </div>
            ) : (
              <div className="aw-human absolute inset-0">
                <SmartImage
                  src={HERO_FULL_HUMAN}
                  alt="금동이 (인간 수사관 전신)"
                  className="h-full w-full"
                  imgClassName="object-cover object-bottom"
                  fallback={<HeroAvatar mode="human" className="h-full w-full" />}
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        </div>
        {/* 터지는 불꽃 */}
        {!charging &&
          sparks.map((p, i) => (
            <span
              key={i}
              className="aw-spark pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-[#ffe7a3]"
              style={{ width: p.s, height: p.s, '--ex': `${p.x}vmin`, '--ey': `${p.y}vmin`, animationDelay: `${p.d}s` }}
            />
          ))}
      </div>

      {/* 번쩍 */}
      <div className="aw-flash pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#ffffff_0%,#fff5d6_35%,rgba(255,230,160,0.6)_65%,rgba(255,220,140,0)_100%)]" />

      {/* 제목 */}
      {!charging && (
        <div className="aw-title pointer-events-none absolute inset-x-0 top-[4vh] px-4 text-center">
          <p className="font-body text-xs tracking-[0.35em] text-[#f6dc94]">AWAKENING</p>
          <h2 className="font-display title-shine mt-2 text-3xl leading-tight sm:text-5xl">금동이, 본래 모습을 되찾다</h2>
        </div>
      )}
      {!charging && (
        <p className="aw-title font-body pointer-events-none absolute inset-x-0 bottom-[12vh] px-4 text-center text-sm text-[#ece0c4] sm:text-base">
          일곱 봉인의 기운이 모여 늠름한 인간 수사관으로 각성했습니다!
        </p>
      )}

      {phase === 'done' ? (
        <button
          onClick={onDone}
          className="aw-continue font-body absolute bottom-[3vh] left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#e2b85c] px-7 py-3 text-base font-bold text-[#1a140c] shadow-[0_0_30px_rgba(246,220,148,0.6)] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40"
        >
          계속하기 <ChevronRight className="h-5 w-5" />
        </button>
      ) : (
        <button
          onClick={onDone}
          className="font-body absolute right-4 top-4 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
        >
          건너뛰기
        </button>
      )}
    </div>
  );
}

/* 엔딩 화면의 대사 한 줄 (비주얼 노벨 스타일, 고정 표시) */
function EndingLine({ speaker, role, text, isPlayer = false, avatar = null, accent = '#e2b85c' }) {
  return (
    <div className="flex items-end gap-3">
      <CharacterPortrait
        src={isPlayer ? HERO_AVATAR_HUMAN : avatar}
        name={speaker}
        variant={isPlayer ? 'human' : 'npc'}
        accent={accent}
        className="h-28 w-20 shrink-0 sm:h-36 sm:w-28"
      />
      <div className="relative min-w-0 flex-1 rounded-2xl border-2 border-[#5a4426] bg-gradient-to-b from-[#261e15] to-[#15110d] px-4 pb-4 pt-6 text-left">
        <div className="absolute -top-4 left-3">
          <NameTag name={speaker} isPlayer={isPlayer} />
        </div>
        <p className="font-body text-xs text-[#9c8c6e]">{role}</p>
        <p className="font-body mt-1 text-[15px] leading-7 text-[#f1e6cb]">{text}</p>
      </div>
    </div>
  );
}

/* 화자 이름표 (입체 배지) */
function NameTag({ name, isPlayer }) {
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-sm sm:text-base ${isPlayer
        ? 'border-[#bfe9de] bg-gradient-to-b from-[#62ad9b] to-[#2d6659] text-[#f2fffb] shadow-[0_3px_0_#1b4038,0_10px_18px_-6px_rgba(0,0,0,0.7)]'
        : 'border-[#fbe7a8] bg-gradient-to-b from-[#f3d184] to-[#b6852f] text-[#2a1d0e] shadow-[0_3px_0_#6e4a1c,0_10px_18px_-6px_rgba(0,0,0,0.7)]'
        }`}
    >
      {isPlayer ? <Search className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
      {name}
    </span>
  );
}

/* 타자기 효과 (대사 상자를 누르면 한 번에 다 보기) */
function useTypewriter(text, speed = 40) {
  const [state, setState] = useState({ text, count: 0 });
  // 대사가 바뀐 첫 렌더에서도 이전 길이로 번쩍이지 않도록 text 기준으로 계산
  const count = state.text === text ? state.count : 0;

  useEffect(() => {
    setState({ text, count: 0 });
    const id = setInterval(() => {
      setState((st) => {
        if (st.text !== text || st.count >= text.length) {
          clearInterval(id);
          return st;
        }
        return { text, count: st.count + 1 };
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  const done = count >= text.length;
  return [text.slice(0, count), done, () => setState({ text, count: text.length })];
}

/* 비주얼 노벨 스타일 대화창 */
function DialogueBox({
  speaker,
  text,
  avatar,
  heroMode = 'beast',
  npcRole,
  isPlayer,
  narration = false,
  accent,
  progress,
  canNext,
  nextLabel,
  onNext,
  waitingLabel,
  voiceOn = false,
  sfxOn = false,
  voiceProfile,
  sceneAvatar = null,
  sceneName = '',
}) {
  const variant = isPlayer ? heroMode : 'npc';
  const displayName = isPlayer ? HERO_NAME : speaker;
  const [shown, done, skip] = useTypewriter(text);
  const [speaking, setSpeaking] = useState(false);
  const voiceId = voiceProfile?.id;
  const pitch = voiceProfile?.pitch ?? 1;
  const rate = voiceProfile?.rate ?? 1;
  const playbackRate = voiceProfile?.playbackRate ?? 1;

  // 음성 읽기: 인물별로 미리 만든 음성 파일을 재생 (없으면 브라우저 내장 음성), 넘기면 바로 멈춤
  useEffect(() => {
    if (!voiceOn) return undefined;
    const onStart = () => setSpeaking(true);
    const onEnd = () => setSpeaking(false);
    const fallback = () => Speech.speak(text, { pitch, rate: rate * playbackRate }, onStart, onEnd);
    if (voiceId) VoicePlayer.play(voiceFile(voiceId, text), { onStart, onEnd, fallback, rate: playbackRate });
    else fallback();
    return () => {
      VoicePlayer.stop();
      setSpeaking(false);
    };
  }, [text, voiceOn, voiceId, pitch, rate, playbackRate]);

  // 음성이 꺼져 있으면 글자가 찍힐 때 '톡톡' 타자 소리 (인물 목소리 높낮이 반영)
  useEffect(() => {
    if (!sfxOn || voiceOn || done || shown.length % 2 !== 1) return;
    if (/\s/.test(shown[shown.length - 1])) return;
    Sound.blip(narration ? 0.8 : pitch);
  }, [shown, sfxOn, voiceOn, done, narration, pitch]);

  const advance = () => (done ? onNext() : skip());
  const talking = !narration && (!done || speaking);

  const nextButton = (
    <div className="relative mt-3 flex min-h-[40px] items-center justify-end">
      {canNext ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
          className="font-body inline-flex items-center gap-1.5 rounded-full border border-[#e2b85c]/50 bg-[#e2b85c]/10 px-4 py-2 text-sm font-bold text-[#e2b85c] transition hover:bg-[#e2b85c]/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/30"
        >
          {nextLabel} <ChevronRight className={`h-4 w-4 ${done ? 'nudge-right' : ''}`} />
        </button>
      ) : (
        waitingLabel &&
        done && (
          <span className="font-body inline-flex items-center gap-1.5 text-xs text-[#9c8c6e]">
            <ScrollText className="h-4 w-4" /> {waitingLabel}
          </span>
        )
      )}
    </div>
  );

  // 나레이션: 장면 해설 상자 (이 장소 인물의 초상화를 곁에 조용히 보여 줌)
  if (narration) {
    return (
      <section className={`anim-fade-up relative ${sceneAvatar ? 'pt-20 sm:pt-16' : ''}`} aria-label="나레이션">
        {sceneAvatar && (
          <CharacterPortrait
            key={`scene-${sceneName}`}
            src={sceneAvatar}
            name={sceneName}
            variant="npc"
            accent={accent}
            className="absolute left-3 top-0 z-10 h-32 w-24 sm:bottom-0 sm:left-4 sm:top-auto sm:h-60 sm:w-40"
          />
        )}
        <div
          onClick={!done ? skip : undefined}
          className={`relative rounded-2xl border border-dashed border-[#6b5636] bg-[#120f0c]/80 pb-4 ${sceneAvatar
            ? 'min-h-[176px] px-4 pt-14 sm:min-h-[200px] sm:pl-[188px] sm:pr-6 sm:pt-6'
            : 'px-5 pt-5 sm:px-8'
            }`}
        >
          <div className="font-body flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 tracking-[0.2em] text-[#c9a96b]">
              <ScrollText className="h-3.5 w-3.5" /> 나레이션
            </span>
            <span className="shrink-0 tabular-nums text-[#7d6f57]">{progress}</span>
          </div>
          <p className={`font-display relative mt-3 text-[16px] leading-8 text-[#e8dcc0] sm:text-lg sm:leading-9 ${sceneAvatar ? '' : 'text-center'}`}>
            <span className="invisible" aria-hidden="true">
              {text}
            </span>
            <span className="absolute inset-0" aria-live="polite">
              {shown}
              {!done && <span className="type-caret text-[#c9a96b]">▍</span>}
            </span>
          </p>
          {nextButton}
        </div>
      </section>
    );
  }

  return (
    <section className="anim-fade-up relative pt-20 sm:pt-16" aria-label="대화">
      {/* 캐릭터 초상화: 모바일은 대화창 좌측 상단에 걸치고, PC는 좌측에 크게 */}
      <CharacterPortrait
        key={`${speaker}-${variant}`}
        src={avatar}
        name={displayName}
        variant={variant}
        accent={accent}
        talking={talking}
        className="absolute left-3 top-0 z-10 h-32 w-24 sm:bottom-0 sm:left-4 sm:top-auto sm:h-60 sm:w-40"
      />

      <div
        onClick={!done ? skip : undefined}
        className="relative min-h-[176px] rounded-2xl border-2 border-[#5a4426] bg-gradient-to-b from-[#261e15] to-[#15110d] px-4 pb-4 pt-14 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-12px_rgba(0,0,0,0.75)] sm:min-h-[200px] sm:pl-[188px] sm:pr-6 sm:pt-9"
      >
        <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#e2b85c]/15" />

        {/* 이름표 */}
        <div className="absolute -top-4 left-[116px] z-20 sm:left-[188px]">
          <NameTag name={displayName} isPlayer={isPlayer} />
        </div>

        <div className="font-body relative flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-[#9c8c6e]">
            {isPlayer ? (heroMode === 'human' ? '각성한 인간 수사관' : '향로의 정령 · 특별 수사관') : npcRole}
          </span>
          <span className="shrink-0 tabular-nums text-[#7d6f57]">{progress}</span>
        </div>

        <p className="font-body relative mt-2 text-[15px] leading-7 text-[#f1e6cb] sm:text-[17px] sm:leading-8">
          <span className="invisible" aria-hidden="true">
            {text}
          </span>
          <span className="absolute inset-0" aria-live="polite">
            {shown}
            {!done && <span className="type-caret" style={{ color: isPlayer ? '#9fd0c3' : accent }}>▍</span>}
          </span>
        </p>

        {nextButton}
      </div>
    </section>
  );
}

/* 봉인 획득 팝업: 아이템 이미지를 화면 중앙에 크게 */
function RewardPopup({ stage, count, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current && closeRef.current.focus({ preventScroll: true }), 400);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [onClose]);

  const sparkles = [
    { left: '6%', top: '14%', delay: '0s' },
    { left: '84%', top: '8%', delay: '.4s' },
    { left: '92%', top: '70%', delay: '.8s' },
    { left: '2%', top: '78%', delay: '1.2s' },
    { left: '48%', top: '-4%', delay: '.6s' },
  ];

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="봉인 획득">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="닫기" onClick={onClose} />
      <div className="reward-pop font-body relative flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative h-52 w-52 sm:h-60 sm:w-60">
          <div
            className="spin-slow absolute -inset-14 rounded-full"
            style={{
              background: 'repeating-conic-gradient(from 0deg, rgba(246,220,148,.3) 0deg 5deg, transparent 5deg 16deg)',
              WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
              maskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
            }}
          />
          <div className="halo-pulse absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(246,220,148,0.55),transparent_66%)]" />
          <span className="relic-glow absolute inset-0 rounded-full" style={{ '--delay': '0s' }} />
          <RewardImage stage={stage} rounded="rounded-full" className="relative h-full w-full border-2 border-[#f6dc94]" iconClassName="h-24 w-24" />
          {sparkles.map((s, i) => (
            <Sparkles key={i} className="twinkle-loop absolute h-6 w-6 text-[#fff3c4]" style={{ left: s.left, top: s.top, '--delay': s.delay }} />
          ))}
        </div>

        <p className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-[#e2b85c]/40 bg-[#e2b85c]/10 px-3 py-1 text-xs tracking-[0.18em] text-[#e2b85c] tabular-nums">
          <KeyRound className="h-3.5 w-3.5" /> 봉인 {count} / {TOTAL} 회수
        </p>
        <h3 className="font-display title-shine mt-3 text-3xl leading-tight sm:text-4xl">{stage.rewardItem.name}</h3>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[#d9ccb0]">{stage.rewardItem.description}</p>
        <button
          ref={closeRef}
          onClick={onClose}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#e2b85c] px-8 py-3 font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40"
        >
          <BookOpen className="h-4 w-4" /> 수첩에 기록하기
        </button>
      </div>
    </div>
  );
}

function QuizPanel({
  quiz,
  answerInput,
  setAnswerInput,
  selectedChoice,
  setSelectedChoice,
  showHint,
  toggleHint,
  onSubmit,
  attempts,
  shakeKey,
  revealAnswer,
}) {
  const shakeRef = useRef(null);
  const inputRef = useRef(null);

  // 두 번 틀리면 두 번째 힌트: 주관식은 글자 수·첫 글자, 객관식은 오답 두 개 지우기
  const secondHint = attempts >= SECOND_HINT_AFTER;
  const eliminated = useMemo(() => {
    if (!secondHint || quiz.type !== 'choice') return [];
    return quiz.choices.filter((c) => !quiz.answers.some((a) => normalize(a) === normalize(c))).slice(0, 2);
  }, [secondHint, quiz]);
  const secondHintText = !secondHint
    ? null
    : quiz.type === 'choice'
      ? `틀린 선택지 ${eliminated.length}개를 지웠어요. 남은 것 중에 정답이 있어요.`
      : (() => {
        const a = String(quiz.answers[0]).replace(/\s+/g, '');
        return `정답은 ${a.length}글자이고, 첫 글자는 '${a[0]}' 자예요.`;
      })();

  // 오답일 때 입력창/선택지를 좌우로 흔들기 (포커스를 잃지 않도록 클래스만 다시 붙임)
  useEffect(() => {
    const el = shakeRef.current;
    if (!shakeKey || !el) return;
    el.classList.remove('anim-shake');
    void el.offsetWidth;
    el.classList.add('anim-shake');
  }, [shakeKey]);

  // 퀴즈가 열리면 주관식 입력창에 바로 포커스 (모바일 키보드는 자동으로 띄우지 않음)
  useEffect(() => {
    if (quiz.type === 'text' && inputRef.current && window.matchMedia('(pointer: fine)').matches) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [quiz]);

  return (
    <section className="anim-fade-up rounded-2xl border border-[#e2b85c]/35 bg-gradient-to-b from-[#241d13] to-[#1c1712] p-4 sm:p-5">
      <div className="font-body flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2b85c]/15 px-2.5 py-1 text-xs font-bold text-[#e2b85c]">
          <KeyRound className="h-3.5 w-3.5" /> 봉인 해제 단서 · {quiz.type === 'choice' ? '객관식' : '주관식'}
        </span>
        {attempts > 0 && <span className="text-xs text-[#9c8c6e] tabular-nums">시도 {attempts}회</span>}
      </div>
      <p className="font-display mt-3 whitespace-pre-line text-lg leading-8 text-[#f6ecd2] sm:text-xl" style={{ textWrap: 'balance' }}>
        {quiz.question}
      </p>

      {revealAnswer && (
        <p className="font-body mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#d9a441]/60 bg-[#d9a441]/10 px-2.5 py-1 text-xs text-[#f3cf7a]">
          <FlaskConical className="h-3.5 w-3.5" /> 정답: {quiz.answers[0]}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <div ref={shakeRef}>
          {quiz.type === 'choice' ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="선택지">
              {quiz.choices.map((c) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedChoice === c}
                  key={c}
                  disabled={eliminated.includes(c)}
                  onClick={() => setSelectedChoice(c)}
                  className={`font-body flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60 ${eliminated.includes(c)
                    ? 'cursor-not-allowed border-[#2e261b] bg-transparent text-[#5f5544] line-through'
                    : selectedChoice === c
                      ? 'border-[#e2b85c] bg-[#e2b85c]/15 text-[#f6ecd2]'
                      : 'border-[#4a3b26] bg-[#1a1612] text-[#d9ccb0] hover:border-[#6b5636]'
                    }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selectedChoice === c ? 'border-[#e2b85c]' : 'border-[#6b5636]'
                      }`}
                  >
                    {selectedChoice === c && <span className="h-2 w-2 rounded-full bg-[#e2b85c]" />}
                  </span>
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <input
              ref={inputRef}
              id="quiz-answer"
              type="text"
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              placeholder={quiz.placeholder}
              autoComplete="off"
              enterKeyHint="send"
              className="font-body w-full rounded-xl border border-[#4a3b26] bg-[#120f0c] px-4 py-3 text-base text-[#f6ecd2] placeholder:text-[#6f6350] focus:border-[#e2b85c] focus:outline-none focus:ring-2 focus:ring-[#e2b85c]/30"
            />
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={toggleHint}
            aria-expanded={showHint}
            className="font-body inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm text-[#c9a96b] transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/50"
          >
            <Lightbulb className="h-4 w-4" /> {showHint ? '힌트 숨기기' : '힌트 보기'}
          </button>
          <button
            type="submit"
            className="font-body inline-flex items-center justify-center gap-2 rounded-full bg-[#e2b85c] px-6 py-2.5 text-sm font-bold text-[#1a140c] transition hover:bg-[#f0cb75] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e2b85c]/40 active:scale-[0.98]"
          >
            <Send className="h-4 w-4" /> 정답 제출
            {quiz.type === 'text' && <span className="hidden text-[11px] font-normal opacity-70 sm:inline">Enter</span>}
          </button>
        </div>
      </form>

      {showHint && (
        <div className="font-body anim-fade-up mt-3 flex items-start gap-2 rounded-xl bg-[#e2b85c]/10 p-3 text-sm leading-6 text-[#e8d6a8]">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#e2b85c]" />
          <span>{quiz.hint}</span>
        </div>
      )}

      {secondHint ? (
        <div className="font-body anim-fade-up mt-3 flex items-start gap-2 rounded-xl border border-[#e2b85c]/30 bg-[#e2b85c]/15 p-3 text-sm leading-6 text-[#f3e2b4]">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#e2b85c]" />
          <span>
            <b className="text-[#f6ecd2]">두 번째 힌트</b> · {secondHintText}
          </span>
        </div>
      ) : (
        attempts > 0 && (
          <p className="font-body mt-3 text-xs text-[#9c8c6e]">
            {SECOND_HINT_AFTER - attempts}번 더 틀리면 두 번째 힌트가 열려요.
          </p>
        )
      )}
    </section>
  );
}

function NotebookModal({ inventory, visitedStages, onClose, onRestart }) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (detailId) setDetailId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, detailId]);

  const detailStage = detailId ? STAGES.find((s) => s.id === detailId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="탐정 수첩">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="닫기" />
      <div className="anim-pop relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#4a3b26] bg-[#1a1612] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[#3a2f20] px-5 py-4">
          <h3 className="font-display flex items-center gap-2 text-xl text-[#f3e7c9]">
            <BookOpen className="h-5 w-5 text-[#e2b85c]" /> 탐정 수첩
          </h3>
          <button onClick={onClose} className="rounded-full p-2 text-[#b8a888] hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60" aria-label="수첩 닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="font-body overflow-y-auto px-5 py-4">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-[#b8a888]">회수한 봉인 · 증거물</span>
            <span className="tabular-nums text-[#e2b85c]">
              {inventory.length} / {TOTAL}
            </span>
          </div>
          {inventory.length > 0 && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-[#9c8c6e]">
              <Info className="h-3.5 w-3.5" /> 회수한 봉인 카드를 누르면 백제 역사 상식을 볼 수 있어요.
            </p>
          )}
          <ul className="flex flex-wrap justify-center gap-2.5">
            {STAGES.map((s) => {
              const item = inventory.find((it) => it.stageId === s.id);
              return (
                <li key={s.id} className="w-[calc(50%-5px)] sm:w-[calc(33.333%-7px)]">
                  <button
                    onClick={() => item && setDetailId(s.id)}
                    disabled={!item}
                    aria-label={item ? `${item.name} 자세히 보기` : `${s.name} 미회수 봉인`}
                    className={`flex h-full w-full flex-col items-center gap-2 rounded-2xl border p-3 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60 ${item
                      ? 'border-[#e2b85c]/40 bg-[#241d13] hover:-translate-y-0.5 hover:border-[#e2b85c]/80 hover:bg-[#2b2316]'
                      : 'cursor-default border-dashed border-[#3a2f20]'
                      }`}
                  >
                    <RewardImage stage={s} owned={!!item} className="aspect-square w-full max-w-[112px] border border-[#4a3b26]" iconClassName="h-10 w-10" />
                    <span className="text-[11px] text-[#9c8c6e] tabular-nums">
                      {String(s.order).padStart(2, '0')} · {s.name}
                    </span>
                    <span className={`text-sm font-bold leading-tight ${item ? 'text-[#f3e7c9]' : 'text-[#5f5442]'}`}>{item ? item.name : '미회수 봉인'}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 border-t border-[#3a2f20] pt-4">
            {confirmRestart ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-[#f2c7b9]">모든 진행 상황이 사라집니다.</span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmRestart(false)} className="rounded-full px-3 py-1.5 text-[#b8a888] hover:bg-white/5">
                    취소
                  </button>
                  <button onClick={onRestart} className="rounded-full bg-[#7a2e1f] px-3 py-1.5 font-bold text-white hover:bg-[#8f3a28]">
                    처음부터 시작
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRestart(true)}
                className="inline-flex items-center gap-1.5 text-xs text-[#9c8c6e] hover:text-[#d9ccb0] disabled:opacity-40"
                disabled={visitedStages.length === 0 && inventory.length === 0}
              >
                <RotateCcw className="h-3.5 w-3.5" /> 수사 초기화
              </button>
            )}
          </div>
        </div>

        {/* 유물 상세 팝업 */}
        {detailStage && <RelicDetail stage={detailStage} onBack={() => setDetailId(null)} />}
      </div>
    </div>
  );
}

function RelicDetail({ stage, onBack }) {
  const { rewardItem } = stage;
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div className="anim-pop font-body w-full overflow-hidden rounded-2xl border border-[#e2b85c]/50 bg-[#1f1913] shadow-2xl" role="dialog" aria-label={`${rewardItem.name} 상세 정보`}>
        <div className="flex gap-4 p-4">
          <RewardImage stage={stage} className="h-24 w-24 shrink-0 border border-[#e2b85c]/50 sm:h-28 sm:w-28" iconClassName="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#c9a96b]">봉인 {String(stage.order).padStart(2, '0')}</p>
            <p className="font-display mt-0.5 text-lg leading-tight text-[#f6ecd2]">{rewardItem.name}</p>
            <p className="mt-1 text-xs leading-5 text-[#b8a888]">{rewardItem.description}</p>
          </div>
        </div>
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-[#3a2f20] bg-[#16120e] p-2">
          <StageImage
            src={stage.image}
            alt={`${stage.name} 사진`}
            stageId={stage.id}
            className="h-14 w-20 shrink-0 rounded-lg"
            iconClassName="h-9 w-9"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-bold text-[#f3e7c9]">
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: THEME[stage.id].accent }} /> {stage.name}
            </p>
            <p className="truncate text-xs text-[#9c8c6e]">{stage.era}</p>
          </div>
        </div>
        {rewardItem.trivia && (
          <div className="mx-4 rounded-xl border border-[#4a3b26] bg-[#16120e] p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#e2b85c]">
              <Lightbulb className="h-3.5 w-3.5" /> 백제 역사 상식 · {rewardItem.trivia.title}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-[#e4d8bc]">{rewardItem.trivia.text}</p>
          </div>
        )}
        <div className="flex justify-end p-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#e2b85c]/50 px-4 py-2 text-sm text-[#e2b85c] transition hover:bg-[#e2b85c]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2b85c]/60"
          >
            <ArrowLeft className="h-4 w-4" /> 수첩으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== 사전 컴파일된 Tailwind CSS =====================
 * 미리보기 환경에 Tailwind 컴파일러가 없어도 임의값 클래스(bg-[#e2b85c] 등)가
 * 그대로 적용되도록, 이 컴포넌트가 쓰는 Tailwind 클래스를 미리 컴파일해 넣었습니다.
 * 클래스를 새로 추가하면 Tailwind 3.4로 다시 컴파일해 이 문자열을 교체하세요.
 * ==================================================================== */
const TAILWIND_CSS = "*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }/*! tailwindcss v3.4.17 | MIT License | https://tailwindcss.com*/*,:after,:before{box-sizing:border-box;border:0 solid #e5e7eb}:after,:before{--tw-content:\"\"}:host,html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;-o-tab-size:4;tab-size:4;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-feature-settings:normal;font-variation-settings:normal;-webkit-tap-highlight-color:transparent}body{margin:0;line-height:inherit}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-feature-settings:normal;font-variation-settings:normal;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}button,input,optgroup,select,textarea{font-family:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-size:100%;font-weight:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;margin:0;padding:0}button,select{text-transform:none}button,input:where([type=button]),input:where([type=reset]),input:where([type=submit]){-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::-moz-placeholder,textarea::-moz-placeholder{opacity:1;color:#9ca3af}input::placeholder,textarea::placeholder{opacity:1;color:#9ca3af}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{max-width:100%;height:auto}[hidden]:where(:not([hidden=until-found])){display:none}.pointer-events-none{pointer-events:none}.invisible{visibility:hidden}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.sticky{position:sticky}.-inset-10{inset:-2.5rem}.-inset-14{inset:-3.5rem}.-inset-6{inset:-1.5rem}.-inset-8{inset:-2rem}.inset-0{inset:0}.inset-1\\.5{inset:.375rem}.inset-2\\.5{inset:.625rem}.inset-4{inset:1rem}.inset-\\[10\\%\\]{inset:10%}.inset-\\[11\\%\\]{inset:11%}.inset-\\[12\\%\\]{inset:12%}.inset-\\[14\\%\\]{inset:14%}.inset-\\[16\\%\\]{inset:16%}.inset-\\[3\\%\\]{inset:3%}.inset-\\[6\\%\\]{inset:6%}.inset-x-0{left:0;right:0}.inset-x-\\[2px\\]{left:2px;right:2px}.-bottom-3{bottom:-.75rem}.-right-1{right:-.25rem}.-top-1{top:-.25rem}.-top-4{top:-1rem}.bottom-0{bottom:0}.bottom-2{bottom:.5rem}.bottom-3{bottom:.75rem}.bottom-6{bottom:1.5rem}.bottom-\\[2px\\]{bottom:2px}.left-1\\/2{left:50%}.left-3{left:.75rem}.left-\\[116px\\]{left:116px}.left-\\[27px\\]{left:27px}.right-0{right:0}.right-2{right:.5rem}.right-\\[6\\%\\]{right:6%}.top-0{top:0}.top-1\\/2{top:50%}.top-6{top:1.5rem}.top-\\[42\\%\\]{top:42%}.z-10{z-index:10}.z-20{z-index:20}.z-30{z-index:30}.z-50{z-index:50}.z-\\[55\\]{z-index:55}.z-\\[60\\]{z-index:60}.mx-4{margin-left:1rem;margin-right:1rem}.mx-auto{margin-left:auto;margin-right:auto}.mb-3{margin-bottom:.75rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}.mt-0\\.5{margin-top:.125rem}.mt-1{margin-top:.25rem}.mt-1\\.5{margin-top:.375rem}.mt-10{margin-top:2.5rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}.mt-5{margin-top:1.25rem}.mt-6{margin-top:1.5rem}.mt-8{margin-top:2rem}.block{display:block}.inline-block{display:inline-block}.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}.hidden{display:none}.aspect-\\[16\\/9\\]{aspect-ratio:16/9}.aspect-\\[3\\/4\\]{aspect-ratio:3/4}.aspect-square{aspect-ratio:1/1}.h-1{height:.25rem}.h-1\\/3{height:33.333333%}.h-1\\/4{height:25%}.h-10{height:2.5rem}.h-11{height:2.75rem}.h-14{height:3.5rem}.h-16{height:4rem}.h-2{height:.5rem}.h-24{height:6rem}.h-28{height:7rem}.h-3{height:.75rem}.h-3\\.5{height:.875rem}.h-32{height:8rem}.h-36{height:9rem}.h-4{height:1rem}.h-40{height:10rem}.h-5{height:1.25rem}.h-52{height:13rem}.h-6{height:1.5rem}.h-7{height:1.75rem}.h-8{height:2rem}.h-9{height:2.25rem}.h-\\[46\\%\\]{height:46%}.h-\\[72\\%\\]{height:72%}.h-\\[86\\%\\]{height:86%}.h-\\[92\\%\\]{height:92%}.h-\\[94\\%\\]{height:94%}.h-full{height:100%}.max-h-\\[88vh\\]{max-height:88vh}.min-h-\\[176px\\]{min-height:176px}.min-h-\\[40px\\]{min-height:40px}.min-h-screen{min-height:100vh}.w-10{width:2.5rem}.w-11{width:2.75rem}.w-14{width:3.5rem}.w-16{width:4rem}.w-2{width:.5rem}.w-20{width:5rem}.w-24{width:6rem}.w-3{width:.75rem}.w-3\\.5{width:.875rem}.w-36{width:9rem}.w-4{width:1rem}.w-40{width:10rem}.w-5{width:1.25rem}.w-52{width:13rem}.w-6{width:1.5rem}.w-7{width:1.75rem}.w-8{width:2rem}.w-9{width:2.25rem}.w-\\[28\\%\\]{width:28%}.w-\\[72\\%\\]{width:72%}.w-\\[72px\\]{width:72px}.w-\\[76px\\]{width:76px}.w-\\[86\\%\\]{width:86%}.w-\\[92\\%\\]{width:92%}.w-\\[calc\\(50\\%-5px\\)\\]{width:calc(50% - 5px)}.w-\\[calc\\(50\\%-6px\\)\\]{width:calc(50% - 6px)}.w-full{width:100%}.w-px{width:1px}.min-w-0{min-width:0}.max-w-2xl{max-width:42rem}.max-w-3xl{max-width:48rem}.max-w-6xl{max-width:72rem}.max-w-\\[112px\\]{max-width:112px}.max-w-\\[120px\\]{max-width:120px}.max-w-\\[250px\\]{max-width:250px}.max-w-\\[440px\\]{max-width:440px}.max-w-\\[70\\%\\]{max-width:70%}.max-w-lg{max-width:32rem}.max-w-md{max-width:28rem}.max-w-prose{max-width:65ch}.max-w-sm{max-width:24rem}.max-w-xl{max-width:36rem}.max-w-xs{max-width:20rem}.flex-1{flex:1 1 0%}.shrink-0{flex-shrink:0}.-translate-x-1\\/2{--tw-translate-x:-50%}.-translate-x-1\\/2,.-translate-y-1\\/2{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.-translate-y-1\\/2{--tw-translate-y:-50%}.-rotate-12{--tw-rotate:-12deg}.-rotate-12,.transform{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.cursor-default{cursor:default}.cursor-not-allowed{cursor:not-allowed}.scroll-mt-28{scroll-margin-top:7rem}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-\\[auto_minmax\\(0\\2c 1fr\\)\\]{grid-template-columns:auto minmax(0,1fr)}.flex-col{flex-direction:column}.flex-col-reverse{flex-direction:column-reverse}.flex-wrap{flex-wrap:wrap}.items-start{align-items:flex-start}.items-end{align-items:flex-end}.items-center{align-items:center}.justify-end{justify-content:flex-end}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.gap-1{gap:.25rem}.gap-1\\.5{gap:.375rem}.gap-2{gap:.5rem}.gap-2\\.5{gap:.625rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-5{gap:1.25rem}.gap-6{gap:1.5rem}.gap-x-3{-moz-column-gap:.75rem;column-gap:.75rem}.gap-y-2{row-gap:.5rem}.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.overflow-x-clip{overflow-x:clip}.truncate{overflow:hidden;text-overflow:ellipsis}.truncate,.whitespace-nowrap{white-space:nowrap}.whitespace-pre-line{white-space:pre-line}.rounded{border-radius:.25rem}.rounded-2xl{border-radius:1rem}.rounded-3xl{border-radius:1.5rem}.rounded-\\[14px\\]{border-radius:14px}.rounded-\\[16px\\]{border-radius:16px}.rounded-\\[20px\\]{border-radius:20px}.rounded-\\[22px\\]{border-radius:22px}.rounded-\\[26px\\]{border-radius:26px}.rounded-\\[28px\\]{border-radius:28px}.rounded-full{border-radius:9999px}.rounded-lg{border-radius:.5rem}.rounded-md{border-radius:.375rem}.rounded-xl{border-radius:.75rem}.rounded-b-\\[14px\\]{border-bottom-right-radius:14px;border-bottom-left-radius:14px}.rounded-t-3xl{border-top-left-radius:1.5rem;border-top-right-radius:1.5rem}.border{border-width:1px}.border-2{border-width:2px}.border-b{border-bottom-width:1px}.border-t{border-top-width:1px}.border-dashed{border-style:dashed}.border-\\[\\#3a2f20\\]{--tw-border-opacity:1;border-color:rgb(58 47 32/var(--tw-border-opacity,1))}.border-\\[\\#4a3b26\\]{--tw-border-opacity:1;border-color:rgb(74 59 38/var(--tw-border-opacity,1))}.border-\\[\\#4f8a5b\\]{--tw-border-opacity:1;border-color:rgb(79 138 91/var(--tw-border-opacity,1))}.border-\\[\\#4f8a5b\\]\\/60{border-color:rgba(79,138,91,.6)}.border-\\[\\#5a4426\\]{--tw-border-opacity:1;border-color:rgb(90 68 38/var(--tw-border-opacity,1))}.border-\\[\\#5a4a32\\]{--tw-border-opacity:1;border-color:rgb(90 74 50/var(--tw-border-opacity,1))}.border-\\[\\#6b5636\\]{--tw-border-opacity:1;border-color:rgb(107 86 54/var(--tw-border-opacity,1))}.border-\\[\\#9a4632\\]\\/60{border-color:rgba(154,70,50,.6)}.border-\\[\\#b0813a\\]{--tw-border-opacity:1;border-color:rgb(176 129 58/var(--tw-border-opacity,1))}.border-\\[\\#b0813a\\]\\/40{border-color:rgba(176,129,58,.4)}.border-\\[\\#b0813a\\]\\/60{border-color:rgba(176,129,58,.6)}.border-\\[\\#bfe9de\\]{--tw-border-opacity:1;border-color:rgb(191 233 222/var(--tw-border-opacity,1))}.border-\\[\\#d9a441\\]{--tw-border-opacity:1;border-color:rgb(217 164 65/var(--tw-border-opacity,1))}.border-\\[\\#d9a441\\]\\/40{border-color:rgba(217,164,65,.4)}.border-\\[\\#d9a441\\]\\/50{border-color:rgba(217,164,65,.5)}.border-\\[\\#d9a441\\]\\/60{border-color:rgba(217,164,65,.6)}.border-\\[\\#e2b85c\\]{--tw-border-opacity:1;border-color:rgb(226 184 92/var(--tw-border-opacity,1))}.border-\\[\\#e2b85c\\]\\/10{border-color:rgba(226,184,92,.1)}.border-\\[\\#e2b85c\\]\\/15{border-color:rgba(226,184,92,.15)}.border-\\[\\#e2b85c\\]\\/35{border-color:rgba(226,184,92,.35)}.border-\\[\\#e2b85c\\]\\/40{border-color:rgba(226,184,92,.4)}.border-\\[\\#e2b85c\\]\\/50{border-color:rgba(226,184,92,.5)}.border-\\[\\#e2b85c\\]\\/60{border-color:rgba(226,184,92,.6)}.border-\\[\\#f6dc94\\]{--tw-border-opacity:1;border-color:rgb(246 220 148/var(--tw-border-opacity,1))}.border-\\[\\#f6dc94\\]\\/70{border-color:hsla(44,84%,77%,.7)}.border-\\[\\#f6dc94\\]\\/80{border-color:hsla(44,84%,77%,.8)}.border-\\[\\#fbe7a8\\]{--tw-border-opacity:1;border-color:rgb(251 231 168/var(--tw-border-opacity,1))}.border-\\[\\#ffd34d\\]\\/70{border-color:rgba(255,211,77,.7)}.border-white\\/15{border-color:hsla(0,0%,100%,.15)}.bg-\\[\\#120f0c\\]{--tw-bg-opacity:1;background-color:rgb(18 15 12/var(--tw-bg-opacity,1))}.bg-\\[\\#14110e\\]{--tw-bg-opacity:1;background-color:rgb(20 17 14/var(--tw-bg-opacity,1))}.bg-\\[\\#14110e\\]\\/90{background-color:rgba(20,17,14,.9)}.bg-\\[\\#15110d\\]{--tw-bg-opacity:1;background-color:rgb(21 17 13/var(--tw-bg-opacity,1))}.bg-\\[\\#16120e\\]{--tw-bg-opacity:1;background-color:rgb(22 18 14/var(--tw-bg-opacity,1))}.bg-\\[\\#1a1612\\]{--tw-bg-opacity:1;background-color:rgb(26 22 18/var(--tw-bg-opacity,1))}.bg-\\[\\#1d1813\\]{--tw-bg-opacity:1;background-color:rgb(29 24 19/var(--tw-bg-opacity,1))}.bg-\\[\\#1d1813\\]\\/80{background-color:rgba(29,24,19,.8)}.bg-\\[\\#1d2a1f\\]{--tw-bg-opacity:1;background-color:rgb(29 42 31/var(--tw-bg-opacity,1))}.bg-\\[\\#1d2a1f\\]\\/80{background-color:rgba(29,42,31,.8)}.bg-\\[\\#1f1913\\]{--tw-bg-opacity:1;background-color:rgb(31 25 19/var(--tw-bg-opacity,1))}.bg-\\[\\#211b15\\]{--tw-bg-opacity:1;background-color:rgb(33 27 21/var(--tw-bg-opacity,1))}.bg-\\[\\#241d13\\]{--tw-bg-opacity:1;background-color:rgb(36 29 19/var(--tw-bg-opacity,1))}.bg-\\[\\#2a2010\\]{--tw-bg-opacity:1;background-color:rgb(42 32 16/var(--tw-bg-opacity,1))}.bg-\\[\\#2a2112\\]{--tw-bg-opacity:1;background-color:rgb(42 33 18/var(--tw-bg-opacity,1))}.bg-\\[\\#2a2219\\]{--tw-bg-opacity:1;background-color:rgb(42 34 25/var(--tw-bg-opacity,1))}.bg-\\[\\#2d1915\\]{--tw-bg-opacity:1;background-color:rgb(45 25 21/var(--tw-bg-opacity,1))}.bg-\\[\\#7a2e1f\\]{--tw-bg-opacity:1;background-color:rgb(122 46 31/var(--tw-bg-opacity,1))}.bg-\\[\\#d9a441\\]{--tw-bg-opacity:1;background-color:rgb(217 164 65/var(--tw-bg-opacity,1))}.bg-\\[\\#d9a441\\]\\/10{background-color:rgba(217,164,65,.1)}.bg-\\[\\#d9a441\\]\\/20{background-color:rgba(217,164,65,.2)}.bg-\\[\\#e2b85c\\]{--tw-bg-opacity:1;background-color:rgb(226 184 92/var(--tw-bg-opacity,1))}.bg-\\[\\#e2b85c\\]\\/10{background-color:rgba(226,184,92,.1)}.bg-\\[\\#e2b85c\\]\\/15{background-color:rgba(226,184,92,.15)}.bg-\\[\\#f3e9d2\\]{--tw-bg-opacity:1;background-color:rgb(243 233 210/var(--tw-bg-opacity,1))}.bg-black\\/45{background-color:rgba(0,0,0,.45)}.bg-black\\/60{background-color:rgba(0,0,0,.6)}.bg-black\\/70{background-color:rgba(0,0,0,.7)}.bg-black\\/75{background-color:rgba(0,0,0,.75)}.bg-\\[radial-gradient\\(circle\\2c \\#ffffff_0\\%\\2c rgba\\(255\\2c 240\\2c 189\\2c 0\\.9\\)_30\\%\\2c rgba\\(226\\2c 184\\2c 92\\2c 0\\.4\\)_60\\%\\2c transparent_75\\%\\)\\]{background-image:radial-gradient(circle,#fff 0,rgba(255,240,189,.9) 30%,rgba(226,184,92,.4) 60%,transparent 75%)}.bg-\\[radial-gradient\\(circle\\2c rgba\\(226\\2c 184\\2c 92\\2c 0\\.35\\)\\2c transparent_65\\%\\)\\]{background-image:radial-gradient(circle,rgba(226,184,92,.35),transparent 65%)}.bg-\\[radial-gradient\\(circle\\2c rgba\\(246\\2c 220\\2c 148\\2c 0\\.5\\)\\2c transparent_65\\%\\)\\]{background-image:radial-gradient(circle,hsla(44,84%,77%,.5),transparent 65%)}.bg-\\[radial-gradient\\(circle\\2c rgba\\(246\\2c 220\\2c 148\\2c 0\\.55\\)\\2c transparent_66\\%\\)\\]{background-image:radial-gradient(circle,hsla(44,84%,77%,.55),transparent 66%)}.bg-\\[radial-gradient\\(circle\\2c rgba\\(246\\2c 220\\2c 148\\2c 0\\.55\\)_0\\%\\2c rgba\\(226\\2c 184\\2c 92\\2c 0\\.22\\)_38\\%\\2c transparent_68\\%\\)\\]{background-image:radial-gradient(circle,hsla(44,84%,77%,.55) 0,rgba(226,184,92,.22) 38%,transparent 68%)}.bg-\\[radial-gradient\\(circle\\2c rgba\\(255\\2c 255\\2c 255\\2c 0\\.04\\)\\2c transparent_70\\%\\)\\]{background-image:radial-gradient(circle,hsla(0,0%,100%,.04),transparent 70%)}.bg-\\[radial-gradient\\(circle_at_35\\%_28\\%\\2c \\#4a3718\\2c \\#1a140c_72\\%\\)\\]{background-image:radial-gradient(circle at 35% 28%,#4a3718,#1a140c 72%)}.bg-\\[radial-gradient\\(circle_at_35\\%_30\\%\\2c rgba\\(246\\2c 220\\2c 148\\2c 0\\.32\\)\\2c rgba\\(226\\2c 184\\2c 92\\2c 0\\.08\\)_60\\%\\2c transparent_72\\%\\)\\]{background-image:radial-gradient(circle at 35% 30%,hsla(44,84%,77%,.32),rgba(226,184,92,.08) 60%,transparent 72%)}.bg-gradient-to-b{background-image:linear-gradient(to bottom,var(--tw-gradient-stops))}.bg-gradient-to-br{background-image:linear-gradient(to bottom right,var(--tw-gradient-stops))}.bg-gradient-to-r{background-image:linear-gradient(to right,var(--tw-gradient-stops))}.bg-gradient-to-t{background-image:linear-gradient(to top,var(--tw-gradient-stops))}.from-\\[\\#182a33\\]{--tw-gradient-from:#182a33 var(--tw-gradient-from-position);--tw-gradient-to:rgba(24,42,51,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#1a1612\\]{--tw-gradient-from:#1a1612 var(--tw-gradient-from-position);--tw-gradient-to:rgba(26,22,18,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#1f2c22\\]{--tw-gradient-from:#1f2c22 var(--tw-gradient-from-position);--tw-gradient-to:rgba(31,44,34,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#241d13\\]{--tw-gradient-from:#241d13 var(--tw-gradient-from-position);--tw-gradient-to:rgba(36,29,19,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#261e15\\]{--tw-gradient-from:#261e15 var(--tw-gradient-from-position);--tw-gradient-to:rgba(38,30,21,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#2a2112\\]{--tw-gradient-from:#2a2112 var(--tw-gradient-from-position);--tw-gradient-to:rgba(42,33,18,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#2b2533\\]{--tw-gradient-from:#2b2533 var(--tw-gradient-from-position);--tw-gradient-to:rgba(43,37,51,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#2c2a1d\\]{--tw-gradient-from:#2c2a1d var(--tw-gradient-from-position);--tw-gradient-to:rgba(44,42,29,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#2f2a24\\]{--tw-gradient-from:#2f2a24 var(--tw-gradient-from-position);--tw-gradient-to:rgba(47,42,36,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#33202a\\]{--tw-gradient-from:#33202a var(--tw-gradient-from-position);--tw-gradient-to:rgba(51,32,42,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#3a2a17\\]{--tw-gradient-from:#3a2a17 var(--tw-gradient-from-position);--tw-gradient-to:rgba(58,42,23,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#62ad9b\\]{--tw-gradient-from:#62ad9b var(--tw-gradient-from-position);--tw-gradient-to:rgba(98,173,155,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#b0813a\\]{--tw-gradient-from:#b0813a var(--tw-gradient-from-position);--tw-gradient-to:rgba(176,129,58,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#e2b85c\\]{--tw-gradient-from:#e2b85c var(--tw-gradient-from-position);--tw-gradient-to:rgba(226,184,92,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#e2b85c\\]\\/50{--tw-gradient-from:rgba(226,184,92,.5) var(--tw-gradient-from-position);--tw-gradient-to:rgba(226,184,92,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#f3d184\\]{--tw-gradient-from:#f3d184 var(--tw-gradient-from-position);--tw-gradient-to:hsla(42,82%,74%,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-\\[\\#fff0bd\\]{--tw-gradient-from:#fff0bd var(--tw-gradient-from-position);--tw-gradient-to:rgba(255,240,189,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-black\\/55{--tw-gradient-from:rgba(0,0,0,.55) var(--tw-gradient-from-position);--tw-gradient-to:transparent var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-black\\/70{--tw-gradient-from:rgba(0,0,0,.7) var(--tw-gradient-from-position);--tw-gradient-to:transparent var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.via-\\[\\#1a1612\\]\\/40{--tw-gradient-to:rgba(26,22,18,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),rgba(26,22,18,.4) var(--tw-gradient-via-position),var(--tw-gradient-to)}.via-\\[\\#4a3b26\\]{--tw-gradient-to:rgba(74,59,38,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),#4a3b26 var(--tw-gradient-via-position),var(--tw-gradient-to)}.via-\\[\\#8a5f25\\]{--tw-gradient-to:rgba(138,95,37,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),#8a5f25 var(--tw-gradient-via-position),var(--tw-gradient-to)}.via-\\[\\#b6852f\\]{--tw-gradient-to:rgba(182,133,47,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),#b6852f var(--tw-gradient-via-position),var(--tw-gradient-to)}.to-\\[\\#0f161a\\]{--tw-gradient-to:#0f161a var(--tw-gradient-to-position)}.to-\\[\\#111612\\]{--tw-gradient-to:#111612 var(--tw-gradient-to-position)}.to-\\[\\#14111a\\]{--tw-gradient-to:#14111a var(--tw-gradient-to-position)}.to-\\[\\#15110d\\]{--tw-gradient-to:#15110d var(--tw-gradient-to-position)}.to-\\[\\#15140e\\]{--tw-gradient-to:#15140e var(--tw-gradient-to-position)}.to-\\[\\#16130f\\]{--tw-gradient-to:#16130f var(--tw-gradient-to-position)}.to-\\[\\#170f13\\]{--tw-gradient-to:#170f13 var(--tw-gradient-to-position)}.to-\\[\\#1a1510\\]{--tw-gradient-to:#1a1510 var(--tw-gradient-to-position)}.to-\\[\\#1b1510\\]{--tw-gradient-to:#1b1510 var(--tw-gradient-to-position)}.to-\\[\\#1c1712\\]{--tw-gradient-to:#1c1712 var(--tw-gradient-to-position)}.to-\\[\\#2d6659\\]{--tw-gradient-to:#2d6659 var(--tw-gradient-to-position)}.to-\\[\\#4a3b26\\]{--tw-gradient-to:#4a3b26 var(--tw-gradient-to-position)}.to-\\[\\#b6852f\\]{--tw-gradient-to:#b6852f var(--tw-gradient-to-position)}.to-\\[\\#e2b85c\\]{--tw-gradient-to:#e2b85c var(--tw-gradient-to-position)}.to-\\[\\#f6dc94\\]{--tw-gradient-to:#f6dc94 var(--tw-gradient-to-position)}.to-black\\/25{--tw-gradient-to:rgba(0,0,0,.25) var(--tw-gradient-to-position)}.to-transparent{--tw-gradient-to:transparent var(--tw-gradient-to-position)}.object-contain{-o-object-fit:contain;object-fit:contain}.object-cover{-o-object-fit:cover;object-fit:cover}.object-bottom{-o-object-position:bottom;object-position:bottom}.object-top{-o-object-position:top;object-position:top}.p-2{padding:.5rem}.p-3{padding:.75rem}.p-3\\.5{padding:.875rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.p-\\[2px\\]{padding:2px}.p-\\[8\\%\\]{padding:8%}.px-1{padding-left:.25rem;padding-right:.25rem}.px-2{padding-left:.5rem;padding-right:.5rem}.px-2\\.5{padding-left:.625rem;padding-right:.625rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-3\\.5{padding-left:.875rem;padding-right:.875rem}.px-4{padding-left:1rem;padding-right:1rem}.px-5{padding-left:1.25rem;padding-right:1.25rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}.px-8{padding-left:2rem;padding-right:2rem}.py-0\\.5{padding-top:.125rem;padding-bottom:.125rem}.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\\.5{padding-top:.375rem;padding-bottom:.375rem}.py-10{padding-top:2.5rem;padding-bottom:2.5rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-2\\.5{padding-top:.625rem;padding-bottom:.625rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-3\\.5{padding-top:.875rem;padding-bottom:.875rem}.py-4{padding-top:1rem;padding-bottom:1rem}.py-5{padding-top:1.25rem;padding-bottom:1.25rem}.pb-14{padding-bottom:3.5rem}.pb-4{padding-bottom:1rem}.pb-6{padding-bottom:1.5rem}.pr-24{padding-right:6rem}.pt-14{padding-top:3.5rem}.pt-20{padding-top:5rem}.pt-4{padding-top:1rem}.pt-6{padding-top:1.5rem}.pt-7{padding-top:1.75rem}.pt-8{padding-top:2rem}.text-left{text-align:left}.text-center{text-align:center}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.text-\\[13px\\]{font-size:13px}.text-\\[14px\\]{font-size:14px}.text-\\[15px\\]{font-size:15px}.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-xs{font-size:.75rem;line-height:1rem}.font-bold{font-weight:700}.font-normal{font-weight:400}.tabular-nums{--tw-numeric-spacing:tabular-nums;font-variant-numeric:var(--tw-ordinal) var(--tw-slashed-zero) var(--tw-numeric-figure) var(--tw-numeric-spacing) var(--tw-numeric-fraction)}.leading-5{line-height:1.25rem}.leading-6{line-height:1.5rem}.leading-7{line-height:1.75rem}.leading-8{line-height:2rem}.leading-tight{line-height:1.25}.tracking-\\[0\\.18em\\]{letter-spacing:.18em}.tracking-\\[0\\.2em\\]{letter-spacing:.2em}.tracking-\\[0\\.35em\\]{letter-spacing:.35em}.tracking-\\[0\\.3em\\]{letter-spacing:.3em}.tracking-wide{letter-spacing:.025em}.tracking-wider{letter-spacing:.05em}.text-\\[\\#1a140c\\]{--tw-text-opacity:1;color:rgb(26 20 12/var(--tw-text-opacity,1))}.text-\\[\\#2a1d0e\\]{--tw-text-opacity:1;color:rgb(42 29 14/var(--tw-text-opacity,1))}.text-\\[\\#3a2a17\\]{--tw-text-opacity:1;color:rgb(58 42 23/var(--tw-text-opacity,1))}.text-\\[\\#4a3820\\]{--tw-text-opacity:1;color:rgb(74 56 32/var(--tw-text-opacity,1))}.text-\\[\\#4f4535\\]{--tw-text-opacity:1;color:rgb(79 69 53/var(--tw-text-opacity,1))}.text-\\[\\#5a4426\\]{--tw-text-opacity:1;color:rgb(90 68 38/var(--tw-text-opacity,1))}.text-\\[\\#5f5442\\]{--tw-text-opacity:1;color:rgb(95 84 66/var(--tw-text-opacity,1))}.text-\\[\\#7d6f57\\]{--tw-text-opacity:1;color:rgb(125 111 87/var(--tw-text-opacity,1))}.text-\\[\\#8a5f25\\]{--tw-text-opacity:1;color:rgb(138 95 37/var(--tw-text-opacity,1))}.text-\\[\\#8a6a3c\\]{--tw-text-opacity:1;color:rgb(138 106 60/var(--tw-text-opacity,1))}.text-\\[\\#8fd19a\\]{--tw-text-opacity:1;color:rgb(143 209 154/var(--tw-text-opacity,1))}.text-\\[\\#9c8c6e\\]{--tw-text-opacity:1;color:rgb(156 140 110/var(--tw-text-opacity,1))}.text-\\[\\#a8d6ae\\]{--tw-text-opacity:1;color:rgb(168 214 174/var(--tw-text-opacity,1))}.text-\\[\\#b8a888\\]{--tw-text-opacity:1;color:rgb(184 168 136/var(--tw-text-opacity,1))}.text-\\[\\#bfe3c3\\]{--tw-text-opacity:1;color:rgb(191 227 195/var(--tw-text-opacity,1))}.text-\\[\\#c9a96b\\]{--tw-text-opacity:1;color:rgb(201 169 107/var(--tw-text-opacity,1))}.text-\\[\\#cdbf9f\\]{--tw-text-opacity:1;color:rgb(205 191 159/var(--tw-text-opacity,1))}.text-\\[\\#cfeccf\\]{--tw-text-opacity:1;color:rgb(207 236 207/var(--tw-text-opacity,1))}.text-\\[\\#d9ccb0\\]{--tw-text-opacity:1;color:rgb(217 204 176/var(--tw-text-opacity,1))}.text-\\[\\#e0d3b6\\]{--tw-text-opacity:1;color:rgb(224 211 182/var(--tw-text-opacity,1))}.text-\\[\\#e2b85c\\]{--tw-text-opacity:1;color:rgb(226 184 92/var(--tw-text-opacity,1))}.text-\\[\\#e4d6b4\\]{--tw-text-opacity:1;color:rgb(228 214 180/var(--tw-text-opacity,1))}.text-\\[\\#e4d8bc\\]{--tw-text-opacity:1;color:rgb(228 216 188/var(--tw-text-opacity,1))}.text-\\[\\#e8d6a8\\]{--tw-text-opacity:1;color:rgb(232 214 168/var(--tw-text-opacity,1))}.text-\\[\\#e8dcc0\\]{--tw-text-opacity:1;color:rgb(232 220 192/var(--tw-text-opacity,1))}.text-\\[\\#ece0c4\\]{--tw-text-opacity:1;color:rgb(236 224 196/var(--tw-text-opacity,1))}.text-\\[\\#f08a6c\\]{--tw-text-opacity:1;color:rgb(240 138 108/var(--tw-text-opacity,1))}.text-\\[\\#f0e6cc\\]{--tw-text-opacity:1;color:rgb(240 230 204/var(--tw-text-opacity,1))}.text-\\[\\#f1e6cb\\]{--tw-text-opacity:1;color:rgb(241 230 203/var(--tw-text-opacity,1))}.text-\\[\\#f2c7b9\\]{--tw-text-opacity:1;color:rgb(242 199 185/var(--tw-text-opacity,1))}.text-\\[\\#f2fffb\\]{--tw-text-opacity:1;color:rgb(242 255 251/var(--tw-text-opacity,1))}.text-\\[\\#f3cf7a\\]{--tw-text-opacity:1;color:rgb(243 207 122/var(--tw-text-opacity,1))}.text-\\[\\#f3e7c9\\]{--tw-text-opacity:1;color:rgb(243 231 201/var(--tw-text-opacity,1))}.text-\\[\\#f6dc94\\]{--tw-text-opacity:1;color:rgb(246 220 148/var(--tw-text-opacity,1))}.text-\\[\\#f6ecd2\\]{--tw-text-opacity:1;color:rgb(246 236 210/var(--tw-text-opacity,1))}.text-\\[\\#fbf3de\\]{--tw-text-opacity:1;color:rgb(251 243 222/var(--tw-text-opacity,1))}.text-\\[\\#fff3c4\\]{--tw-text-opacity:1;color:rgb(255 243 196/var(--tw-text-opacity,1))}.text-white{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.opacity-0{opacity:0}.opacity-100{opacity:1}.opacity-25{opacity:.25}.opacity-50{opacity:.5}.opacity-60{opacity:.6}.opacity-70{opacity:.7}.opacity-\\[0\\.05\\]{opacity:.05}.opacity-\\[0\\.07\\]{opacity:.07}.shadow-2xl{--tw-shadow:0 25px 50px -12px rgba(0,0,0,.25);--tw-shadow-colored:0 25px 50px -12px var(--tw-shadow-color)}.shadow-2xl,.shadow-\\[0_14px_30px_-10px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.8\\)\\]{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-\\[0_14px_30px_-10px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.8\\)\\]{--tw-shadow:0 14px 30px -10px rgba(0,0,0,.8);--tw-shadow-colored:0 14px 30px -10px var(--tw-shadow-color)}.shadow-\\[0_3px_0_\\#1b4038\\2c 0_10px_18px_-6px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.7\\)\\]{--tw-shadow:0 3px 0 #1b4038,0 10px 18px -6px rgba(0,0,0,.7);--tw-shadow-colored:0 3px 0 var(--tw-shadow-color),0 10px 18px -6px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-\\[0_3px_0_\\#6e4a1c\\2c 0_10px_18px_-6px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.7\\)\\]{--tw-shadow:0 3px 0 #6e4a1c,0 10px 18px -6px rgba(0,0,0,.7);--tw-shadow-colored:0 3px 0 var(--tw-shadow-color),0 10px 18px -6px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-\\[inset_0_1px_0_rgba\\(255\\2c 255\\2c 255\\2c 0\\.06\\)\\2c 0_18px_40px_-12px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.75\\)\\]{--tw-shadow:inset 0 1px 0 hsla(0,0%,100%,.06),0 18px 40px -12px rgba(0,0,0,.75);--tw-shadow-colored:inset 0 1px 0 var(--tw-shadow-color),0 18px 40px -12px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-black\\/40{--tw-shadow-color:rgba(0,0,0,.4);--tw-shadow:var(--tw-shadow-colored)}.shadow-black\\/60{--tw-shadow-color:rgba(0,0,0,.6);--tw-shadow:var(--tw-shadow-colored)}.ring-1{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.ring-\\[\\#e2b85c\\]\\/50{--tw-ring-color:rgba(226,184,92,.5)}.drop-shadow-\\[0_0_28px_rgba\\(246\\2c 220\\2c 148\\2c 0\\.55\\)\\]{--tw-drop-shadow:drop-shadow(0 0 28px hsla(44,84%,77%,.55))}.drop-shadow-\\[0_0_28px_rgba\\(246\\2c 220\\2c 148\\2c 0\\.55\\)\\],.drop-shadow-\\[0_0_8px_rgba\\(246\\2c 220\\2c 148\\2c 0\\.6\\)\\]{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.drop-shadow-\\[0_0_8px_rgba\\(246\\2c 220\\2c 148\\2c 0\\.6\\)\\]{--tw-drop-shadow:drop-shadow(0 0 8px hsla(44,84%,77%,.6))}.drop-shadow-\\[0_2px_10px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.8\\)\\]{--tw-drop-shadow:drop-shadow(0 2px 10px rgba(0,0,0,.8))}.drop-shadow-\\[0_2px_10px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.8\\)\\],.drop-shadow-\\[0_4px_10px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.5\\)\\]{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.drop-shadow-\\[0_4px_10px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.5\\)\\]{--tw-drop-shadow:drop-shadow(0 4px 10px rgba(0,0,0,.5))}.filter{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.backdrop-blur{--tw-backdrop-blur:blur(8px)}.backdrop-blur,.backdrop-blur-\\[2px\\]{-webkit-backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}.backdrop-blur-\\[2px\\]{--tw-backdrop-blur:blur(2px)}.backdrop-blur-sm{--tw-backdrop-blur:blur(4px);-webkit-backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}.transition{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,-webkit-backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter,-webkit-backdrop-filter;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-all{transition-property:all;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-opacity{transition-property:opacity;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.duration-500{transition-duration:.5s}.duration-700{transition-duration:.7s}.ease-in{transition-timing-function:cubic-bezier(.4,0,1,1)}.ease-in-out{transition-timing-function:cubic-bezier(.4,0,.2,1)}.ease-out{transition-timing-function:cubic-bezier(0,0,.2,1)}.placeholder\\:text-\\[\\#6f6350\\]::-moz-placeholder{--tw-text-opacity:1;color:rgb(111 99 80/var(--tw-text-opacity,1))}.placeholder\\:text-\\[\\#6f6350\\]::placeholder{--tw-text-opacity:1;color:rgb(111 99 80/var(--tw-text-opacity,1))}.hover\\:-translate-y-0\\.5:hover{--tw-translate-y:-0.125rem;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.hover\\:border-\\[\\#5a4a32\\]:hover{--tw-border-opacity:1;border-color:rgb(90 74 50/var(--tw-border-opacity,1))}.hover\\:border-\\[\\#6b5636\\]:hover{--tw-border-opacity:1;border-color:rgb(107 86 54/var(--tw-border-opacity,1))}.hover\\:border-\\[\\#e2b85c\\]\\/80:hover{border-color:rgba(226,184,92,.8)}.hover\\:bg-\\[\\#2b2316\\]:hover{--tw-bg-opacity:1;background-color:rgb(43 35 22/var(--tw-bg-opacity,1))}.hover\\:bg-\\[\\#8f3a28\\]:hover{--tw-bg-opacity:1;background-color:rgb(143 58 40/var(--tw-bg-opacity,1))}.hover\\:bg-\\[\\#d9a441\\]\\/15:hover{background-color:rgba(217,164,65,.15)}.hover\\:bg-\\[\\#e2b85c\\]\\/10:hover{background-color:rgba(226,184,92,.1)}.hover\\:bg-\\[\\#e2b85c\\]\\/20:hover{background-color:rgba(226,184,92,.2)}.hover\\:bg-\\[\\#f0c25e\\]:hover{--tw-bg-opacity:1;background-color:rgb(240 194 94/var(--tw-bg-opacity,1))}.hover\\:bg-\\[\\#f0cb75\\]:hover{--tw-bg-opacity:1;background-color:rgb(240 203 117/var(--tw-bg-opacity,1))}.hover\\:bg-white\\/5:hover{background-color:hsla(0,0%,100%,.05)}.hover\\:text-\\[\\#b8a888\\]:hover{--tw-text-opacity:1;color:rgb(184 168 136/var(--tw-text-opacity,1))}.hover\\:text-\\[\\#d9ccb0\\]:hover{--tw-text-opacity:1;color:rgb(217 204 176/var(--tw-text-opacity,1))}.focus\\:border-\\[\\#e2b85c\\]:focus{--tw-border-opacity:1;border-color:rgb(226 184 92/var(--tw-border-opacity,1))}.focus\\:outline-none:focus{outline:2px solid transparent;outline-offset:2px}.focus\\:ring-2:focus{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.focus\\:ring-\\[\\#e2b85c\\]\\/30:focus{--tw-ring-color:rgba(226,184,92,.3)}.focus-visible\\:ring-2:focus-visible{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.focus-visible\\:ring-4:focus-visible{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(4px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.focus-visible\\:ring-\\[\\#e2b85c\\]\\/30:focus-visible{--tw-ring-color:rgba(226,184,92,.3)}.focus-visible\\:ring-\\[\\#e2b85c\\]\\/40:focus-visible{--tw-ring-color:rgba(226,184,92,.4)}.focus-visible\\:ring-\\[\\#e2b85c\\]\\/50:focus-visible{--tw-ring-color:rgba(226,184,92,.5)}.focus-visible\\:ring-\\[\\#e2b85c\\]\\/60:focus-visible{--tw-ring-color:rgba(226,184,92,.6)}.active\\:scale-\\[0\\.98\\]:active{--tw-scale-x:0.98;--tw-scale-y:0.98;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.disabled\\:cursor-not-allowed:disabled{cursor:not-allowed}.disabled\\:opacity-40:disabled{opacity:.4}@media (min-width:640px){.sm\\:bottom-0{bottom:0}.sm\\:left-4{left:1rem}.sm\\:left-\\[188px\\]{left:188px}.sm\\:top-auto{top:auto}.sm\\:ml-auto{margin-left:auto}.sm\\:block{display:block}.sm\\:inline{display:inline}.sm\\:flex{display:flex}.sm\\:aspect-\\[21\\/9\\]{aspect-ratio:21/9}.sm\\:h-14{height:3.5rem}.sm\\:h-20{height:5rem}.sm\\:h-28{height:7rem}.sm\\:h-36{height:9rem}.sm\\:h-52{height:13rem}.sm\\:h-6{height:1.5rem}.sm\\:h-60{height:15rem}.sm\\:min-h-\\[200px\\]{min-height:200px}.sm\\:w-14{width:3.5rem}.sm\\:w-20{width:5rem}.sm\\:w-28{width:7rem}.sm\\:w-40{width:10rem}.sm\\:w-52{width:13rem}.sm\\:w-6{width:1.5rem}.sm\\:w-60{width:15rem}.sm\\:w-\\[92px\\]{width:92px}.sm\\:w-\\[calc\\(25\\%-9px\\)\\]{width:calc(25% - 9px)}.sm\\:w-\\[calc\\(33\\.333\\%-7px\\)\\]{width:calc(33.333% - 7px)}.sm\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.sm\\:grid-cols-\\[minmax\\(0\\2c 250px\\)_minmax\\(0\\2c 1fr\\)\\]{grid-template-columns:minmax(0,250px) minmax(0,1fr)}.sm\\:flex-row{flex-direction:row}.sm\\:items-center{align-items:center}.sm\\:justify-between{justify-content:space-between}.sm\\:gap-2{gap:.5rem}.sm\\:gap-3{gap:.75rem}.sm\\:gap-4{gap:1rem}.sm\\:gap-8{gap:2rem}.sm\\:gap-x-4{-moz-column-gap:1rem;column-gap:1rem}.sm\\:rounded-3xl{border-radius:1.5rem}.sm\\:p-4{padding:1rem}.sm\\:p-5{padding:1.25rem}.sm\\:p-6{padding:1.5rem}.sm\\:p-7{padding:1.75rem}.sm\\:px-3{padding-left:.75rem;padding-right:.75rem}.sm\\:px-4{padding-left:1rem;padding-right:1rem}.sm\\:px-9{padding-left:2.25rem;padding-right:2.25rem}.sm\\:pb-8{padding-bottom:2rem}.sm\\:pl-\\[188px\\]{padding-left:188px}.sm\\:pr-28{padding-right:7rem}.sm\\:pr-6{padding-right:1.5rem}.sm\\:pt-16{padding-top:4rem}.sm\\:pt-9{padding-top:2.25rem}.sm\\:text-left{text-align:left}.sm\\:text-2xl{font-size:1.5rem;line-height:2rem}.sm\\:text-3xl{font-size:1.875rem;line-height:2.25rem}.sm\\:text-4xl{font-size:2.25rem;line-height:2.5rem}.sm\\:text-5xl{font-size:3rem;line-height:1}.sm\\:text-\\[15px\\]{font-size:15px}.sm\\:text-\\[17px\\]{font-size:17px}.sm\\:text-base{font-size:1rem;line-height:1.5rem}.sm\\:text-lg{font-size:1.125rem;line-height:1.75rem}.sm\\:text-sm{font-size:.875rem;line-height:1.25rem}.sm\\:text-xl{font-size:1.25rem;line-height:1.75rem}.sm\\:text-xs{font-size:.75rem;line-height:1rem}.sm\\:leading-8{line-height:2rem}}@media (min-width:1024px){.lg\\:sticky{position:sticky}.lg\\:top-24{top:6rem}.lg\\:grid-cols-\\[minmax\\(0\\2c 1fr\\)_340px\\]{grid-template-columns:minmax(0,1fr) 340px}.lg\\:self-start{align-self:flex-start}}";
