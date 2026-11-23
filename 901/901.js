const canvas = document.getElementById("canvas");
let sentences = [];

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function randomizeCase(text) {
  return [...text]
    .map((char) => {
      if (!/[a-zA-Z]/.test(char)) {
        return char;
      }
      return Math.random() < 0.5 ? char.toUpperCase() : char.toLowerCase();
    })
    .join("");
}

function createTapePattern(text) {
  const separator = "    ";
  const repeatCount = Math.max(30, Math.ceil(350 / text.length));

  const repeatedArray = [];
  for (let i = 0; i < repeatCount; i++) {
    repeatedArray.push(randomizeCase(text));
  }

  const fullString = repeatedArray.join(separator);
  const cycleLength = text.length + separator.length;
  const startOffset = Math.floor(Math.random() * cycleLength);

  return fullString.slice(startOffset);
}

// 문장 개수에 맞춰 세로 캔버스 길이를 훨씬 넉넉히 확보
function updateCanvasHeight() {
  const baseHeight = window.innerHeight * 10;
  // const extraHeight = sentences.length * 120; // 문장이 아주 많아질 때를 대비해 주석 처리
  canvas.style.minHeight = `${baseHeight}px`;
}

function renderSentence(text) {
  const el = document.createElement("span");
  el.classList.add("sentence");
  el.textContent = createTapePattern(text);

  el.style.left = "-70vw";

  // 대부분(85%)은 앞쪽 300vh에 모으고, 가끔(15%)은 전체 캔버스 끝까지 뻗게 하기
  const reachBottom = Math.random() < 0.15;
  const maxTop = reachBottom ? Math.max(window.innerHeight * 9.5, canvas.offsetHeight - 40) : window.innerHeight * 3;

  const posY = getRandomNumber(0, maxTop);
  el.style.top = `${posY}px`;

  el.style.transform = `rotate(${getRandomNumber(-3, 3)}deg)`;

  canvas.appendChild(el);
}

async function loadSentences() {
  try {
    const response = await fetch("901.txt");
    const text = await response.text();

    sentences = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    updateCanvasHeight();
    sentences.forEach((sentence) => renderSentence(sentence));
  } catch (error) {
    console.error("문장 파일을 불러오지 못했습니다:", error);
  }
}

window.addEventListener("click", () => {
  if (sentences.length === 0) return;
  const randomIndex = Math.floor(Math.random() * sentences.length);
  renderSentence(sentences[randomIndex]);
});

loadSentences();
