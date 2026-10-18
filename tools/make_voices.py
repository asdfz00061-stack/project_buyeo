"""대사 음성 파일 만들기 (부여 시간 탐정)

BuyeoTimeDetective.jsx 에서 대사를 읽어 인물별 목소리로 audio/voice/*.mp3 를 만듭니다.
대사를 고치거나 추가한 뒤 이 스크립트를 다시 실행하면 바뀐 대사만 새로 만들고,
더 이상 쓰지 않는 음성 파일은 지웁니다.

음성: OpenAI gpt-4o-mini-tts (인물별 목소리 + 연기 지시문, 유료 API · 59줄 전체 약 0.15달러)
준비:  python -m pip install openai soundfile
       PC 환경 변수 OPENAI_API_KEY 에 API 키 저장 (setx OPENAI_API_KEY "키")
실행:  python tools/make_voices.py          (바뀐 것만)
       python tools/make_voices.py --all    (전부 다시 만들기: VOICES 설정을 바꿨을 때)
       python tools/make_voices.py --only curator,boatman   (그 인물만 다시 만들기)
"""

import asyncio
import re
import sys
from pathlib import Path

from openai import AsyncOpenAI

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "BuyeoTimeDetective.jsx"
OUT = ROOT / "audio" / "voice"

# 인물별 목소리 (OpenAI gpt-4o-mini-tts). voice = 기본 목소리, inst = 연기 지시문
# 목소리·지시문을 바꾼 뒤에는  python tools/make_voices.py --all  로 전부 다시 만듭니다.
MODEL = "gpt-4o-mini-tts"
_COMMON = (
    " Deliver the Korean dialogue with natural native pronunciation and polished, professional character acting. "
    "Studio-quality dry voice recording. No robotic narration, no theatrical overacting."
)
VOICES = {
    # 나레이션: 할머니가 들려주는 옛날이야기
    "narrator": dict(voice="coral", inst=(
        "일흔이 넘은 다정한 할머니가 화롯가에서 손주에게 옛날이야기를 들려주는 목소리. "
        "따뜻하고 나지막하게, 속삭이듯 신비로운 분위기로 듣는 사람을 이야기 속으로 끌어들인다. "
        "아주 천천히, 문장 사이에 긴장감 있는 쉼을 두고, 비밀을 털어놓듯 낮게 말하는 대목을 살린다. "
        "딱딱한 낭독이 아니라 살아 있는 이야기꾼처럼 억양을 크게 살린다."
    )),
    # 학예연구사: 20대 초반, 이제 막 일을 시작한 여리여리한 신입 연구원
    "curator": dict(voice="coral", inst=(
        'A shy, delicate young Korean woman of about twenty-two, a brand-new junior museum curator at the Buyeo National Museum. '
        'Very soft, gentle, airy and slightly breathy voice in a naturally high, girlish register, slender and fragile-sounding (여리여리한 목소리), light and sweet like a timid college student. '
        'Speaks softly and politely, a little nervous and earnest about the strange incident, warmly relieved to see the detective. '
        'Never loud, never mature, never middle-aged, never deep, husky or authoritative, no announcer tone. '
        'Natural native Korean pronunciation, polished voice acting, studio-quality dry recording.'
    )),
    # 노승: 여든 넘은 할아버지 스님
    "monk": dict(voice="ash", inst=(
        "여든이 넘은 아주 늙은 할아버지 스님. 쉬고 갈라진 목소리, 숨이 섞인 거친 목소리로 떨리듯 말한다. "
        "젊은 느낌이 전혀 없어야 한다. 매우 느리고 힘없이, 그러나 자비롭게. "
        "'나무아미타불'은 길게 읊조리고, 말끝을 늘어뜨리며 중간중간 숨을 고른다."
    )),
    # 백제 수문장: 거친 장수 (사용자 지시문)
    "gatekeeper": dict(voice="ash", inst=(
        "A powerful, deep, rugged Korean male voice, approximately 40 years old, performed by an elite professional Korean voice actor "
        "specializing in historical war dramas and AAA fantasy video games. He portrays a battle-hardened royal palace gatekeeper of the ancient "
        "Baekje Kingdom. His voice is extremely masculine, low-pitched, gravelly, weathered, and commanding, with a thick chest resonance and a "
        "naturally rough, slightly raspy texture. Every word carries the weight of a seasoned warrior who has survived countless battles. Strong "
        "diaphragmatic projection, firm consonants, deliberate pacing, and authoritative vocal control. His delivery is stern, intimidating, "
        "disciplined, and deeply dignified. He speaks in powerful, formal historical Korean with authentic native pronunciation. Controlled "
        "aggression and restrained intensity, with occasional explosive force when issuing commands. Natural human vocal imperfections and subtle "
        "breaths add realism. Cinematic professional character acting, not theatrical overacting. Studio-quality dry voice recording. No cartoon "
        "villain voice, no artificial bass distortion, no constant shouting, no robotic monotone."
    )),
    # 뱃사공: 여든 후반~아흔의 아주 늙은 강가 노인, 하오체 (허허, ~이오, ~구려)
    "boatman": dict(voice="ash", inst=(
        "A frail, very old Korean boatman in his late eighties or nineties who has rowed the Baengma River for over seventy years. "
        "An unmistakably ancient great-grandfather voice: thin, shaky, crackly and wheezy with age, hoarse breath between phrases, "
        "a little toothless softness, slow and unhurried. Warm, kindly and folksy, with an easygoing chuckle ('허허'), "
        "speaking old-fashioned 하오체 (~이오, ~구려, ~시오) like a village elder by the river, with a touch of melancholy for Baekje. "
        "Never strong, never middle-aged, never formal or stiff. Natural native Korean pronunciation, realistic character acting, studio-quality dry recording."
    )),
    # 궁녀: 20대 초반의 아름다운 궁녀 (사용자 지시문)
    "court_lady": dict(voice="sage", inst=(
        "Perform as a young adult Korean woman in her early twenties, a graceful royal court lady of ancient Baekje. Use a distinctly feminine, "
        "youthful, light, clear and sweet-sounding voice with a naturally higher vocal register. The voice must sound like a professionally trained "
        "young Korean female voice actress, never masculine, deep, husky, or androgynous. Speak with delicate articulation, bright resonance, elegant "
        "phrasing, and gentle warmth. Maintain a soft, melodious, youthful feminine quality throughout every sentence. Deliver the Korean dialogue "
        "with natural native pronunciation and subtle historical-drama elegance. Sound poised, refined, charming and welcoming, with a gentle smile "
        "in the voice. Avoid childish squeaking, exaggerated cuteness, breathy whispering, robotic narration, and theatrical overacting."
    )),
    # 능지기: 왕릉을 지키는 엄숙한 노인, 하옵소체 (~이옵니다, ~사옵니다, ~시옵소서)
    "tomb_keeper": dict(voice="onyx", inst=(
        "An old, solemn Korean tomb keeper in his late sixties who has served and guarded the royal tombs of Baekje all his life. "
        "Deep, low, hushed and reverent voice, almost whispering as if not to wake the sleeping kings, with slow, measured, ceremonial pacing "
        "and long respectful pauses. He speaks in archaic, deeply deferential 하옵소체 (~이옵니다, ~사옵니다, ~시옵소서) like a loyal royal servant — "
        "mysterious, grave and a little eerie, completely unlike a folksy countryman. "
        "Natural native Korean pronunciation, polished professional character acting, studio-quality dry recording."
    )),
    # 해설사: 시를 낭송하듯 부드러운 해설사
    "docent": dict(voice="echo", inst=(
        "A gentle, cultured Korean man in his thirties, a literature docent at the Shin Dong-yeop Literary Museum. "
        "Soft, warm, sincere and slightly poetic voice, speaking with quiet passion and deep respect for the poet, as if reciting poetry. "
        "Calm, kind and thoughtful pacing with expressive emotional warmth." + _COMMON
    )),
    # 금동이(정령): 남녀 구분 없는 대여섯 살 아기 꾸러기
    "hero_beast": dict(voice="alloy", inst=(
        "Geumdongi in spirit form: a tiny golden mascot spirit. Play it as a very young, mischievous little kid of about five or six, with a completely gender-neutral, babyish voice — the listener cannot tell whether it is a boy or a girl. High, round, soft and bubbly toddler-like timbre, cheeky and giggly, bursting with curiosity, a little bit lisping cuteness is fine. Bouncy, playful rhythm like a kid playing detective; when reading the quoted inscription, switch to an exaggerated, spooky little whisper. Never mature, never a grown woman's voice, never a teenager. Natural native Korean pronunciation, studio-quality dry recording. "
        "Play every line extra lively and expressive: a noticeably faster, bouncy tempo, big emotional reactions — "
        "excited gasps, giggles, squeals of wonder, dramatic surprise — like the hero of a kids' animated show. Never flat or calm."
    )),
    # 금동이(각성): 환희에 찬 열일곱 살 소년 수사관
    "hero_human": dict(voice="verse", inst=(
        "Geumdongi after awakening into his true form: a confident, heroic Korean teenage boy of about seventeen in golden armor. "
        "Bright, clear, youthful male voice full of wonder and rising excitement, building to a triumphant, joyful climax. "
        "Like the protagonist in a fantasy adventure game." + _COMMON
    )),
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


# 정답을 맞힌 직후 인물의 첫 반응 대사 (clearDialogues 의 첫 줄) 에 덧붙이는 감정 지시
JOY = (
    " IMPORTANT for this line: it is the character's reaction the very moment the detective answers the riddle correctly. "
    "Deliver it with vivid, genuine emotion: a sharp, excited gasp of realization on the first words, then delighted, admiring joy and warm "
    "relief, as if a long-awaited secret has finally been unlocked. Clearly more animated, expressive and joyful than the character's usual tone, "
    "while staying fully in character (keep the same age, voice texture and personality)."
)
JOY_LINES = set()  # (목소리 id, 대사)

# 각성 장면 두 대사 공통: 국어책 읽듯 밋밋하지 않게, 목소리를 높게
HIGH = (" Pitch the voice HIGH — noticeably higher than a normal speaking voice — with wild, exaggerated ups and downs like an anime character, "
        "never a steady reading voice.")

# 금동이 각성 대사: 가장 감정이 큰 장면이라 이 대사만 전용 지시 (열네 살 애니 주인공, 큰 억양)
AWAKEN = (
    "Geumdongi in spirit form: a mischievous, gender-neutral little kid of about five or six with a high, bubbly, babyish voice. "
    "This is the moment right BEFORE the transformation: all seven seals' golden power is pouring into the tiny spirit's body. "
    "'이 빛은…!' — a sharp, astonished gasp, voice jumping up high with wonder. "
    "Then '일곱 봉인의 힘이… 하나로 모여… 몸 안으로 흘러들어 와…!' — breathless, trembling with thrill, pitch climbing higher and higher, "
    "speeding up with mounting excitement, ending on a held, quivering breath as if something huge is about to happen. "
    "Huge, vivid emotion like a kids' anime hero about to power up. Never flat, never calm, never an adult or teenage voice. "
    "Natural native Korean pronunciation, studio-quality dry recording." + HIGH
)
AWAKEN_LINES = set()

# 엔딩 변신 장면 전용 대사와 지시 (목소리 id, 상수 이름, 지시)
SCENE_LINES = {
    "AWAKEN_REVEAL": ("hero_human", "You are Geumdongi, a fourteen-year-old Korean boy, the young hero of a fantasy adventure anime, at the exact moment he finally transforms back into his true form after a long journey. He is OVERJOYED — the happiest moment of his life. Shout it out at full volume with explosive, ecstatic joy: a huge triumphant cry '드디어 본래 모습을 되찾았어!!!' with the voice soaring high and almost cracking with happiness, then a jubilant '해냈다아!!' and bursting into real, heartfelt laughter '하하하!'. Fast, energetic tempo, big pitch jumps, breathy excitement, grinning ear to ear. Clearly a young teenage boy's voice, bright and boyish. Absolutely never flat, calm, slow, or like reading a textbook. Natural native Korean pronunciation, studio-quality dry recording." + HIGH),
}
SCENE_INST = {}  # 대사 → 지시 (collect_lines 에서 채움)

# 모든 대사 공통: 사투리 없이 표준어로 (가끔 지방 억양이 섞여 나오는 것 방지)
STANDARD = (
    " Speak standard Seoul Korean (표준어) only, with standard pronunciation and intonation — "
    "absolutely no regional dialect (사투리) or regional accent, and keep exactly the same voice and character throughout."
)

# 특정 대사에만 덧붙이는 연기 지시 (대사 글 → 추가 지시)
LINE_EXTRA = {
    "청동 거울에 내 얼굴이… 어? 방금 거울 속에 처음 보는 형아가 비친 것 같은데?!": (
        " IMPORTANT for this line: unhurried, with clear pauses. Start slow and curious, leaning in to peer at the mirror — "
        "'청동 거울에 내 얼굴이…' trailing off softly. Then a sudden, startled little '어?' after a short beat of silence. "
        "Then, half spooked and half amazed, eyes wide, '방금 거울 속에 처음 보는 형아가 비친 것 같은데?!' rising with goosebumps-y wonder "
        "and ending on an excited, disbelieving question. Big, vivid emotion, never rushed."
    ),
    "국립부여박물관의 백제금동대향로에 깃든 일곱 봉인이 풀려 부여의 유적지로 흩어졌습니다. 특별 수사관인 당신은 각 장소를 탐방하고 단서를 풀어 봉인을 되찾아야 합니다.": (
        " 이 대사는 게임의 첫 장면이다: 억양을 아주 크게, 극적으로 살린다. '일곱 봉인이 풀려'에서 목소리를 낮추고 신비롭게 끌다가 "
        "'흩어졌습니다'에서 놀란 듯 힘을 주고, 잠깐 쉰 뒤 '특별 수사관인 당신은'을 듣는 사람을 콕 집듯 또렷하게 부르며, "
        "'봉인을 되찾아야 합니다'는 사명을 맡기듯 힘 있고 설레게 끝맺는다. 단조로운 낭독은 절대 안 된다."
    ),
    "봉황…! 맞아요. 봉황은 태평성대에만 나타난다는 새죠. 깃털 조각이 첫 번째 봉인이었군요.": (
        " IMPORTANT for this line: the first word '봉황…!' must be a soft, high, breathy, girlish little gasp of wonder — "
        "never a low, deep or masculine sound. Keep the whole line in the same light, high young-woman voice."
    ),
    "히익, 깜짝이야! …괜찮아, 난 향로의 정령이라고! 역사라면 자신 있어요!": (
        " IMPORTANT for this line: start with a real, startled little shriek '히이익!' and a flustered '깜짝이야!' as if the gatekeeper's shout "
        "made him jump, then a quick nervous breath, and bounce back with puffed-up, cheeky bravado — '괜찮아, 난 향로의 정령이라고!' "
        "said proudly with chest out, ending with a confident, grinning '역사라면 자신 있어요!'. Fast, bouncy and very expressive."
    ),
    "봉황 깃털이다! 앗, 몸이 살짝 따뜻해졌어. 봉인을 다 모으면 나 어떻게 되는 거지?": (
        " IMPORTANT for this line: shout '봉황 깃털이다!!' with explosive joy like finding treasure, then ONE surprised little gasp '앗!' (say it only once) "
        "as warmth spreads through the body, and end with a wide-eyed, wondering, slightly nervous-excited question. Big, playful emotion."
    ),
    "배 타는 거 처음이에요! 강바람 시원하다~ 근데 물속에 정말 백제 이야기가 흐르고 있어요?": (
        " IMPORTANT for this line: bursting with delight on the first boat ride — a long, thrilled '우와아' and a happy, breezy, sing-song "
        "'강바람 시원하다~', then lean in with sparkling curiosity on the question. Bouncy, giggly, full of wonder."
    ),
    "시인이 사셨던 곳이구나. 나도 시 한 줄 지어 볼까? …음, 금동이는 반짝반짝 금빛~ 헤헤.": (
        " IMPORTANT for this line: playful and cheeky — get excited about writing a poem, ponder with a cute '으음…', "
        "then proudly sing-song the silly little verse '금동이는~ 반짝반짝~ 금빛~!' and burst into a shy, giggly '헤헤헤!'."
    ),
    "오셨군요, 금동이 수사관님. 어젯밤 자정, 백제금동대향로 진열장에서 금빛이 번쩍이더니 향로에 깃든 일곱 개의 봉인이 사라졌습니다.": (
        " IMPORTANT for this line: it is her very first greeting, so make it noticeably brighter and faster. "
        "Open with a cheerful, bubbly, relieved '오셨군요, 금동이 수사관님!' with a big smile in the voice, as if she has been anxiously waiting and is so glad he came. "
        "Then tell what happened in a quick, lively, excited rush, like eagerly sharing big news — brisk upbeat pace, rising energetic intonation, "
        "only a brief hush of wonder on '금빛이 번쩍이더니'. Not stiff, not formal, not slow."
    ),
}


def collect_lines(src: str):
    """(목소리 id, 대사) 목록"""
    lines = set()
    hero_lines = []

    # 장소 데이터의 { speaker, avatar, [next], text } 대사
    # 각 clearDialogues 배열의 첫 대사 위치 = 정답 직후 반응
    joy_starts = set()
    for cm in re.finditer(r"clearDialogues:\s*\[", src):
        first = re.compile(r"speaker:").search(src, cm.end())
        if first:
            joy_starts.add(first.start())

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
            if m.start() in joy_starts:
                JOY_LINES.add((SPEAKERS[speaker], text))
        else:
            print(f"  ! 목소리가 정해지지 않은 인물: {speaker}")

    # 주인공 대사는 정령/인간 두 목소리 모두
    for text in hero_lines:
        lines.add(("hero_beast", text))

    # 공통 대사
    def const(name):
        m = re.search(name + r"\s*=\s*(?:" + STR + ")", src)
        return unescape(m.group(1) if m.group(1) is not None else m.group(2))

    awaken = const("AWAKEN_LINE")
    lines.add(("narrator", const("INTRO_NARRATION")))  # 시작 화면 소개 글
    lines.add(("hero_beast", awaken))
    AWAKEN_LINES.add(("hero_beast", awaken))
    for const_name, (vid, inst) in SCENE_LINES.items():
        t = const(const_name)
        lines.add((vid, t))
        SCENE_INST[t] = inst
    # 인물별 남은 봉인 안내 · 마지막 완성 대사
    for block_name in ("GUIDE_LINES", "FINALE_LINES"):
        block = re.search(r"const " + block_name + r" = \{(.*?)\n\};", src, re.S).group(1)
        for m in re.finditer(r"^\s*'?([^':\n]+?)'?:\s*(?:" + STR + ")", block, re.M):
            speaker = m.group(1).strip()
            lines.add((SPEAKERS[speaker], unescape(m.group(2) if m.group(2) is not None else m.group(3))))
    return sorted(lines)


SPOKEN_OVERRIDE = {
    "히익, 깜짝이야! …괜찮아, 난 향로의 정령이라고! 역사라면 자신 있어요!":
        "히이익! 깜짝이야!! …괘, 괜찮아! 난 향로의 정령이라고! 역사라면 자신 있어요!!",
    "드디어 본래 모습을 되찾았어!": "드디어 본래 모습을 되찾았어!!! 해냈다아!! 하하하!",
    "오셨군요, 금동이 수사관님. 어젯밤 자정, 백제금동대향로 진열장에서 금빛이 번쩍이더니 향로에 깃든 일곱 개의 봉인이 사라졌습니다.":
        "오셨군요, 금동이 수사관님! 어젯밤 자정, 백제금동대향로 진열장에서 금빛이 번쩍이더니, 향로에 깃든 일곱 개의 봉인이 사라졌습니다!",
    "이 빛은…! 일곱 봉인의 힘이 하나로 모여 몸 안으로 흘러들어 와…!":
        "이 빛은…!! 일곱 봉인의 힘이… 하나로 모여… 몸 안으로 흘러들어 와…!!",
    "봉황 깃털이다! 앗, 몸이 살짝 따뜻해졌어. 봉인을 다 모으면 나 어떻게 되는 거지?":
        "봉황 깃털이다!! 앗! 몸이 살짝 따뜻해졌어! 봉인을 다 모으면… 나 어떻게 되는 거지?!",
    "배 타는 거 처음이에요! 강바람 시원하다~ 근데 물속에 정말 백제 이야기가 흐르고 있어요?":
        "우와아, 배 타는 거 처음이에요!! 강바람 시원하다~! 근데요, 물속에 정말 백제 이야기가 흐르고 있어요?!",
    "시인이 사셨던 곳이구나. 나도 시 한 줄 지어 볼까? …음, 금동이는 반짝반짝 금빛~ 헤헤.":
        "와, 시인이 사셨던 곳이구나! 나도 시 한 줄 지어 볼까? 으음… 금동이는~ 반짝반짝~ 금빛~! 헤헤헤!",
}


def spoken(text: str) -> str:
    text = SPOKEN_OVERRIDE.get(text, text)
    for pat, rep in SAY:
        text = pat.sub(rep, text)
    return text


_client = None


def age_voice(y, sr):
    """아주 늙은 목소리로: 살짝 낮추고, 떨림을 넣고, 소리를 조금 탁하게 (뱃사공용)"""
    import librosa
    import numpy as np
    from scipy.signal import butter, lfilter

    y = librosa.effects.pitch_shift(y.astype(np.float32), sr=sr, n_steps=-1.3)
    t = np.arange(len(y)) / sr
    y = y * (1 - 0.16 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.6 * t)))  # 노인 특유의 떨림
    b, a = butter(2, 3800 / (sr / 2), "low")  # 탁하고 오래된 느낌
    y = lfilter(b, a, y)
    return np.clip(y / (np.max(np.abs(y)) + 1e-9) * 0.92, -1, 1)


AGED = set()  # 목소리에 노화 처리를 하는 인물 (가공하면 기계음처럼 들려서 지금은 쓰지 않음)
MANUAL = {"boatman"}  # 타입캐스트로 직접 녹음한 인물 (자동 생성 안 함)


def encode_mp3(wav_bytes: bytes, path: Path, vid: str = "") -> None:
    """말소리용으로 가볍게 저장 (모노 56kbps · 태블릿에서 빨리 받도록)"""
    import io

    import soundfile as sf

    y, sr = sf.read(io.BytesIO(wav_bytes))
    if y.ndim > 1:
        y = y.mean(axis=1)
    if vid in AGED:
        y = age_voice(y, sr)
    sf.write(str(path), y, sr, format="MP3", bitrate_mode="CONSTANT", compression_level=0.7)


async def make(vid: str, text: str, path: Path, sem: asyncio.Semaphore) -> bool:
    """성공하면 True. 실패한 대사는 빈 파일을 남기지 않습니다."""
    global _client
    if _client is None:
        _client = AsyncOpenAI()  # OPENAI_API_KEY 환경 변수 사용
    async with sem:
        cfg = VOICES[vid]
        last = None
        for attempt in range(4):
            try:
                r = await _client.audio.speech.create(
                    model=MODEL, voice=cfg["voice"], input=spoken(text), response_format="wav",
                    instructions=SCENE_INST[text] if text in SCENE_INST else ((AWAKEN if (vid, text) in AWAKEN_LINES
                                  else cfg["inst"] + (JOY if (vid, text) in JOY_LINES else "") + LINE_EXTRA.get(text, "")) + STANDARD),
                )
                if not r.content:
                    raise RuntimeError("빈 음성")
                encode_mp3(r.content, path, vid)
                return True
            except Exception as e:  # 일시 오류는 잠시 쉬었다가 다시 시도
                last = e
                await asyncio.sleep(2 + attempt * 3)
        print(f"  ! 실패: {vid} · {text[:30]}… ({last})")
        return False


async def main():
    redo_all = "--all" in sys.argv
    # --only curator,boatman : 그 인물들만 다시 만들기 (다른 인물 음성은 그대로)
    only = set()
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    OUT.mkdir(parents=True, exist_ok=True)
    lines = collect_lines(SOURCE.read_text(encoding="utf-8"))
    wanted = {OUT / f"{vid}-{text_hash(text)}.mp3": (vid, text) for vid, text in lines}

    # 직접 녹음(타입캐스트)한 인물은 --all/--only 로도 덮어쓰지 않음 (파일이 없을 때만 알려 줌)
    for p, (v, t) in wanted.items():
        if v in MANUAL and not p.exists():
            print(f"  ! 직접 녹음이 필요한 대사 ({v}): {t}")
    todo = [(p, v, t) for p, (v, t) in wanted.items()
            if v not in MANUAL and (redo_all or v in only or not p.exists() or p.stat().st_size == 0)]
    print(f"대사 {len(wanted)}개 · 새로 만들 것 {len(todo)}개")
    sem = asyncio.Semaphore(4)
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
