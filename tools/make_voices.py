"""대사 음성 파일 만들기 (부여 시간 탐정)

BuyeoTimeDetective.jsx 에서 대사를 읽어 인물별 목소리로 audio/voice/*.mp3 를 만듭니다.
대사를 고치거나 추가한 뒤 이 스크립트를 다시 실행하면 바뀐 대사만 새로 만들고,
더 이상 쓰지 않는 음성 파일은 지웁니다.

준비:  python -m pip install edge-tts
실행:  python tools/make_voices.py          (바뀐 것만)
       python tools/make_voices.py --all    (전부 다시 만들기: VOICES 설정을 바꿨을 때)
"""

import asyncio
import re
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "BuyeoTimeDetective.jsx"
OUT = ROOT / "audio" / "voice"

# 인물별 목소리. voice = Microsoft 신경망 음성, rate/volume = %, pitch = Hz
# 한국어 음성은 SunHi(여), InJoon(남), Hyunsu(남) 세 가지라 빠르기·높낮이로 인물을 구분합니다.
VOICES = {
    "narrator": dict(voice="ko-KR-SunHiNeural", rate="-12%", pitch="-6Hz", volume="+0%"),       # 차분한 해설
    "curator": dict(voice="ko-KR-SunHiNeural", rate="+6%", pitch="+4Hz", volume="+0%"),         # 또렷하고 밝은 연구사
    "court_lady": dict(voice="ko-KR-SunHiNeural", rate="-14%", pitch="+10Hz", volume="-5%"),    # 부드럽고 단아한 궁녀
    "monk": dict(voice="ko-KR-InJoonNeural", rate="-24%", pitch="-20Hz", volume="-5%"),         # 느리고 낮은 노승
    "gatekeeper": dict(voice="ko-KR-HyunsuMultilingualNeural", rate="+4%", pitch="-12Hz", volume="+20%"),  # 굵고 힘찬 수문장
    "boatman": dict(voice="ko-KR-InJoonNeural", rate="-12%", pitch="-8Hz", volume="+0%"),       # 느긋한 뱃사공
    "tomb_keeper": dict(voice="ko-KR-HyunsuMultilingualNeural", rate="-20%", pitch="-24Hz", volume="-5%"),  # 낮고 무거운 능지기
    "docent": dict(voice="ko-KR-InJoonNeural", rate="+0%", pitch="+4Hz", volume="+0%"),         # 친절한 해설사
    "hero_beast": dict(voice="ko-KR-SunHiNeural", rate="+12%", pitch="+45Hz", volume="+0%"),    # 높고 귀여운 정령 금동이
    "hero_human": dict(voice="ko-KR-HyunsuMultilingualNeural", rate="+8%", pitch="+10Hz", volume="+0%"),  # 씩씩한 소년 수사관
}

# 게임 속 이름 → 목소리 id (BuyeoTimeDetective.jsx 의 VOICE 와 같아야 합니다)
SPEAKERS = {
    "NARRATOR": "narrator",
    "학예연구사": "curator",
    "노승": "monk",
    "백제 수문장": "gatekeeper",
    "뱃사공": "boatman",
    "궁녀": "court_lady",
    "능지기": "tomb_keeper",
    "해설사": "docent",
}
HERO = "수사관 (나)"

# 읽을 때만 바꿔 읽을 표현 (화면 글자는 그대로)
SAY = [
    (re.compile(r"(\d+(?:\.\d+)?)cm"), r"\1센티미터"),
    (re.compile(r"[《》「」『』]"), ""),
]

STR = r"""'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)\""""


def unescape(s: str) -> str:
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")


def text_hash(s: str) -> str:
    """BuyeoTimeDetective.jsx 의 textHash 와 같은 FNV-1a (UTF-16 단위)"""
    h = 0x811C9DC5
    data = s.encode("utf-16-le")
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def collect_lines(src: str):
    """(목소리 id, 대사) 목록"""
    lines = set()
    hero_lines = []

    # 장소 데이터의 { speaker, avatar, [next], text } 대사
    for m in re.finditer(r"speaker:\s*(NARRATOR|'([^']*)')", src):
        speaker = "NARRATOR" if m.group(1) == "NARRATOR" else m.group(2)
        block = src[m.end(): src.find("}", m.end())]
        t = re.search(r"text:\s*(?:" + STR + ")", block)
        if not t:
            continue  # 상수로 된 공통 대사는 아래에서 처리
        text = unescape(t.group(1) if t.group(1) is not None else t.group(2))
        if speaker == HERO:
            hero_lines.append(text)
        elif speaker in SPEAKERS:
            lines.add((SPEAKERS[speaker], text))
        else:
            print(f"  ! 목소리가 정해지지 않은 인물: {speaker}")

    # 주인공 대사는 정령/인간 두 목소리 모두
    for text in hero_lines:
        lines.add(("hero_beast", text))
        lines.add(("hero_human", text))

    # 공통 대사
    def const(name):
        m = re.search(name + r"\s*=\s*(?:" + STR + ")", src)
        return unescape(m.group(1) if m.group(1) is not None else m.group(2))

    finale, awaken = const("FINALE_LINE"), const("AWAKEN_LINE")
    lines.add(("hero_human", awaken))
    guide_block = re.search(r"const GUIDE_LINES = \{(.*?)\n\};", src, re.S).group(1)
    for m in re.finditer(r"^\s*'?([^':\n]+?)'?:\s*(?:" + STR + ")", guide_block, re.M):
        speaker = m.group(1).strip()
        lines.add((SPEAKERS[speaker], unescape(m.group(2) if m.group(2) is not None else m.group(3))))
    for speaker, vid in SPEAKERS.items():
        if speaker != "NARRATOR":
            lines.add((vid, finale))
    return sorted(lines)


def spoken(text: str) -> str:
    for pat, rep in SAY:
        text = pat.sub(rep, text)
    return text


async def make(vid: str, text: str, path: Path, sem: asyncio.Semaphore) -> bool:
    """성공하면 True. 실패한 대사는 빈 파일을 남기지 않습니다."""
    async with sem:
        cfg = VOICES[vid]
        for attempt in range(6):
            try:
                audio = bytearray()
                async for chunk in edge_tts.Communicate(spoken(text), **cfg).stream():
                    if chunk["type"] == "audio":
                        audio += chunk["data"]
                if not audio:
                    raise RuntimeError("빈 음성")
                path.write_bytes(bytes(audio))
                return True
            except Exception as e:  # 서버가 가끔 응답을 비우므로 잠시 쉬었다가 다시 시도
                await asyncio.sleep(2 + attempt * 2)
                last = e
        print(f"  ! 실패: {vid} · {text[:30]}… ({last})")
        return False


async def main():
    redo_all = "--all" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    lines = collect_lines(SOURCE.read_text(encoding="utf-8"))
    wanted = {OUT / f"{vid}-{text_hash(text)}.mp3": (vid, text) for vid, text in lines}

    todo = [(p, v, t) for p, (v, t) in wanted.items() if redo_all or not p.exists() or p.stat().st_size == 0]
    print(f"대사 {len(wanted)}개 · 새로 만들 것 {len(todo)}개")
    sem = asyncio.Semaphore(2)
    results = await asyncio.gather(*(make(v, t, p, sem) for p, v, t in todo))
    failed = results.count(False)
    if failed:
        print(f"실패 {failed}개: 잠시 뒤 다시 실행하면 실패한 것만 다시 만듭니다.")

    removed = [p for p in OUT.glob("*.mp3") if p not in wanted]
    for p in removed:
        p.unlink()
    size = sum(p.stat().st_size for p in OUT.glob("*.mp3"))
    print(f"완료 · 지운 파일 {len(removed)}개 · 전체 {size / 1024 / 1024:.1f}MB")


if __name__ == "__main__":
    asyncio.run(main())
