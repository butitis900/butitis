const canvas = document.getElementById("dustCanvas");
const ctx = canvas.getContext("2d");

// 미니맵 캔버스 설정
const minimapCanvas = document.getElementById("minimapCanvas");
const miniCtx = minimapCanvas.getContext("2d");
const minimapContainer = document.getElementById("minimapContainer");

let particles = [];

// --- 무한 캔버스 카메라 & 좌표계 설정 ---
const WORLD_SIZE = 8000; // 가상 공간 전체 크기 (8000x8000px)
let camera = {
  x: WORLD_SIZE / 2,
  y: WORLD_SIZE / 2,
  zoom: 1,
  minZoom: 0.3,
  maxZoom: 3,
};

// 드래그 & 관성 관련 변수
let isDragging = false;
let startX = 0;
let startY = 0;
let vx = 0;
let vy = 0;
let lastTouchX = 0;
let lastTouchY = 0;

// 핀치 줌 관련 변수
let initialPinchDistance = null;
let initialZoom = 1;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  minimapCanvas.width = minimapContainer.clientWidth;
  minimapCanvas.height = minimapContainer.clientHeight;
}
window.addEventListener("resize", resizeCanvas);

// --- 파티클 클래스 ---
class DustParticle {
  constructor(src, type, customX, customY) {
    // customX, customY가 전달되면 그 좌표를 쓰고, 없으면 무작위 지정
    this.x = customX !== undefined ? customX : Math.random() * WORLD_SIZE;
    this.y = customY !== undefined ? customY : Math.random() * WORLD_SIZE;
    this.src = src;
    this.type = type;

    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;

    if (this.type === "video") {
      this.baseRadius = Math.random() * 8 + 6;
      this.alpha = Math.random() * 0.5 + 0.4;
      this.pulseSpeed = Math.random() * 0.02 + 0.01;
      this.angle = Math.random() * Math.PI * 2;
    } else {
      this.size = Math.random() * 3 + 2;
      this.alpha = Math.random() * 0.5 + 0.2;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0) this.x = WORLD_SIZE;
    if (this.x > WORLD_SIZE) this.x = 0;
    if (this.y < 0) this.y = WORLD_SIZE;
    if (this.y > WORLD_SIZE) this.y = 0;

    if (this.type === "video") {
      this.angle += this.pulseSpeed;
      this.alpha = 0.3 + Math.sin(this.angle) * 0.4;
    }
  }

  draw() {
    const screenX = (this.x - camera.x) * camera.zoom + canvas.width / 2;
    const screenY = (this.y - camera.y) * camera.zoom + canvas.height / 2;

    const margin = 100 * camera.zoom;
    if (screenX < -margin || screenX > canvas.width + margin || screenY < -margin || screenY > canvas.height + margin) {
      return;
    }

    if (this.type === "video") {
      ctx.save();
      const currentRadius = (this.baseRadius + Math.sin(this.angle) * 3) * camera.zoom;

      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, Math.max(0.1, currentRadius));

      gradient.addColorStop(0, `rgba(235, 245, 255, ${this.alpha + 0.2})`);
      gradient.addColorStop(0.35, `rgba(120, 190, 255, ${this.alpha * 0.7})`);
      gradient.addColorStop(0.7, `rgba(80, 150, 240, ${this.alpha * 0.2})`);
      gradient.addColorStop(1, "rgba(80, 150, 240, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, Math.max(0.1, currentRadius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
      const size = this.size * camera.zoom;
      ctx.fillRect(screenX, screenY, size, size);
    }
  }
}

// --- 샤프한 라이다 미니맵 렌더링 함수 ---
// --- 샤프한 파란색 라이다 미니맵 렌더링 함수 ---
function drawMinimap() {
  const mWidth = minimapCanvas.width;
  const mHeight = minimapCanvas.height;

  miniCtx.clearRect(0, 0, mWidth, mHeight);

  // 1. 전체 파티클 위치 도트 시각화 (파란색 계열)
  particles.forEach((p) => {
    const miniX = (p.x / WORLD_SIZE) * mWidth;
    const miniY = (p.y / WORLD_SIZE) * mHeight;

    if (p.type === "video") {
      miniCtx.fillStyle = "#33bbff"; // 밝은 파란색 도트 (비디오)
      miniCtx.fillRect(Math.floor(miniX), Math.floor(miniY), 2, 2);
    } else {
      miniCtx.fillStyle = "rgba(255, 255, 255, 0.6)"; // 은은한 흰색 도트 (이미지)
      miniCtx.fillRect(Math.floor(miniX), Math.floor(miniY), 1, 1);
    }
  });

  // 2. 현재 카메라 뷰포트 (파란색 박스 영역)
  const viewWidthInWorld = canvas.width / camera.zoom;
  const viewHeightInWorld = canvas.height / camera.zoom;

  const boxW = (viewWidthInWorld / WORLD_SIZE) * mWidth;
  const boxH = (viewHeightInWorld / WORLD_SIZE) * mHeight;
  const boxX = ((camera.x - viewWidthInWorld / 2) / WORLD_SIZE) * mWidth;
  const boxY = ((camera.y - viewHeightInWorld / 2) / WORLD_SIZE) * mHeight;

  // 3. 파란색 선 표현
  miniCtx.save();
  miniCtx.strokeStyle = "#0099ff"; // 블루 선
  miniCtx.lineWidth = 1;
  miniCtx.shadowBlur = 0;

  // 영역 테두리 그리기
  miniCtx.strokeRect(boxX, boxY, boxW, boxH);

  // 박스 내부 반투명 파란색 채우기
  miniCtx.fillStyle = "rgba(0, 153, 255, 0.2)";
  miniCtx.fillRect(boxX, boxY, boxW, boxH);

  miniCtx.restore();
}

// --- 데이터 로드 ---
async function loadDataAndInit() {
  try {
    const response = await fetch("data.json");
    const data = await response.json();

    particles = [];

    // 1. 일반 이미지 파티클 배치 (기존 동일)
    if (data.images) {
      data.images.forEach((src) => {
        for (let i = 0; i < 2; i++) {
          particles.push(new DustParticle(src, "image"));
        }
      });
    }

    // 2. 비디오 파티클 배치 (서로 뭉치지 않게 거리 보장)
    // 2. 비디오 파티클 배치 (첫 번째 비디오는 화면 중앙 근처에 보장!)
    if (data.videos) {
      const existingVideoParticles = [];
      const MIN_DISTANCE = 2500; // 파티클 간 최소 거리

      data.videos.forEach((src, index) => {
        let x, y, isTooClose;
        let attempts = 0;

        if (index === 0) {
          // 💡 첫 번째 영상 파티클은 카메라 시작 위치(화면 중앙) 근처 600px 범위 내에 무작위 배치!
          const centerOffset = 600;
          x = WORLD_SIZE / 2 + (Math.random() - 0.5) * centerOffset;
          y = WORLD_SIZE / 2 + (Math.random() - 0.5) * centerOffset;
        } else {
          // 두 번째 영상부터는 서로 뭉치지 않게 거리 보장
          do {
            x = Math.random() * (WORLD_SIZE - 400) + 200;
            y = Math.random() * (WORLD_SIZE - 400) + 200;

            isTooClose = existingVideoParticles.some((p) => {
              const dist = Math.hypot(p.x - x, p.y - y);
              return dist < MIN_DISTANCE;
            });

            attempts++;
          } while (isTooClose && attempts < 50);
        }

        const videoParticle = new DustParticle(src, "video", x, y);
        particles.push(videoParticle);
        existingVideoParticles.push(videoParticle);
      });
    }

    resizeCanvas();
    animate();
  } catch (error) {
    console.error("JSON 데이터를 불러오는 중 오류가 발생했습니다:", error);
  }
}

// --- 애니메이션 루프 ---
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!isDragging) {
    camera.x -= vx / camera.zoom;
    camera.y -= vy / camera.zoom;
    vx *= 0.92;
    vy *= 0.92;
  }

  particles.forEach((p) => {
    p.update();
    p.draw();
  });

  drawMinimap();

  requestAnimationFrame(animate);
}

// --- 메인 캔버스 터치/마우스 이벤트 ---
let dragDistance = 0;

canvas.addEventListener("pointerdown", (e) => {
  isDragging = true;
  dragDistance = 0;
  startX = e.clientX;
  startY = e.clientY;
  lastTouchX = e.clientX;
  lastTouchY = e.clientY;
  vx = 0;
  vy = 0;
});

canvas.addEventListener("pointermove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - lastTouchX;
  const dy = e.clientY - lastTouchY;

  dragDistance += Math.hypot(dx, dy);

  camera.x -= dx / camera.zoom;
  camera.y -= dy / camera.zoom;

  vx = dx;
  vy = dy;

  lastTouchX = e.clientX;
  lastTouchY = e.clientY;
});

canvas.addEventListener("pointerup", (e) => {
  isDragging = false;
  if (dragDistance < 8) {
    checkParticleClick(e.clientX, e.clientY);
  }
});

canvas.addEventListener("pointercancel", () => {
  isDragging = false;
});

// --- 트랙패드 및 휠 제어 보완 (수정 포인트) ---
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();

    // 트랙패드 핀치 줌 제스처나 Ctrl + 휠 제스처는 확대/축소(Zoom)
    if (e.ctrlKey) {
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      camera.zoom = Math.min(Math.max(camera.zoom * zoomFactor, camera.minZoom), camera.maxZoom);
    } else {
      // 트랙패드 두 손가락 드래그 및 일반 스크롤은 화면 이동(Pan)
      // 화면 방향과 자연스럽게 맞물리도록 + 연산 처리
      camera.x += e.deltaX / camera.zoom;
      camera.y += e.deltaY / camera.zoom;
    }
  },
  { passive: false },
);

// 모바일 핀치 줌
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    isDragging = false;
    initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    initialZoom = camera.zoom;
  }
});

canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2 && initialPinchDistance) {
    const currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const scale = currentDistance / initialPinchDistance;
    camera.zoom = Math.min(Math.max(initialZoom * scale, camera.minZoom), camera.maxZoom);
  }
});

canvas.addEventListener("touchend", () => {
  initialPinchDistance = null;
});

// --- 미니맵 터치/클릭으로 메인 카메라 이동 제어 ---
let isMinimapDragging = false;

function moveCameraByMinimap(e) {
  const rect = minimapContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const targetX = (clickX / rect.width) * WORLD_SIZE;
  const targetY = (clickY / rect.height) * WORLD_SIZE;

  camera.x = Math.min(Math.max(targetX, 0), WORLD_SIZE);
  camera.y = Math.min(Math.max(targetY, 0), WORLD_SIZE);
}

minimapContainer.addEventListener("pointerdown", (e) => {
  isMinimapDragging = true;
  moveCameraByMinimap(e);
  e.stopPropagation();
});

window.addEventListener("pointermove", (e) => {
  if (isMinimapDragging) {
    moveCameraByMinimap(e);
  }
});

window.addEventListener("pointerup", () => {
  isMinimapDragging = false;
});

// --- 파티클 선택 판정 ---
function checkParticleClick(clickX, clickY) {
  const isMobile = window.innerWidth <= 768;

  const target = particles.find((p) => {
    const screenX = (p.x - camera.x) * camera.zoom + canvas.width / 2;
    const screenY = (p.y - camera.y) * camera.zoom + canvas.height / 2;

    const dx = screenX - clickX;
    const dy = screenY - clickY;

    let hitRadius = isMobile ? (p.type === "video" ? 40 : 35) : p.type === "video" ? 25 : 18;
    hitRadius *= Math.max(0.8, camera.zoom);

    return Math.sqrt(dx * dx + dy * dy) < hitRadius;
  });

  if (target) {
    showModal(target);
  }
}

// --- 모달 제어 ---
const modal = document.getElementById("mediaModal");
const modalImg = document.getElementById("modalImg");
const modalVideo = document.getElementById("modalVideo");
const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function showModal(particle) {
  if (particle.type === "image") {
    modalVideo.pause();
    modalVideo.removeAttribute("src");
    modalVideo.load();
    modalVideo.classList.add("hidden");

    modalImg.src = particle.src;
    modalImg.classList.remove("hidden");
  } else if (particle.type === "video") {
    modalImg.src = BLANK_IMAGE;
    modalImg.classList.add("hidden");

    modalVideo.src = particle.src;
    modalVideo.classList.remove("hidden");
    modalVideo.load();
    modalVideo.play();
  }

  modal.classList.remove("hidden");
}

function hideModal() {
  modal.classList.add("hidden");

  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  // 비디오 정지 및 오디오 리소스 완벽 해제
  modalVideo.pause();
  modalVideo.currentTime = 0; // 재생 위치 초기화
  modalVideo.removeAttribute("src"); // 오디오 세션 완전 종료
  modalVideo.load();

  modalImg.src = BLANK_IMAGE;
}

// 모달을 터치/클릭하여 닫을 때 미니맵 제스처 이벤트로 이벤트가 번지지 않도록 완전 차단
modal.addEventListener("pointerdown", (e) => {
  hideModal();
  e.stopPropagation(); // 미니맵 닫기 이벤트(outside click) 전파 방지
  e.stopImmediatePropagation();
});

modal.addEventListener("pointerdown", (e) => {
  hideModal();
  e.stopPropagation();
});

loadDataAndInit();

// --- 미니맵 제스처 제어 ---
const minimapTrigger = document.getElementById("minimapTrigger");
// const minimapContainer는 코드 상단에 이미 선언되어 있어야 합니다.

let triggerStartX = 0;
let triggerStartY = 0;
let isGestureActive = false;
let gestureTarget = null; // 'trigger' | 'container' | 'outside'

function setMinimapActive(active) {
  if (active) {
    minimapContainer.classList.add("active");
  } else {
    minimapContainer.classList.remove("active");
  }
}

// 1. 우측 상단 모서리 터치 시작 (열기 전용)
minimapTrigger.addEventListener("pointerdown", (e) => {
  isGestureActive = true;
  gestureTarget = "trigger";
  triggerStartX = e.clientX;
  triggerStartY = e.clientY;
  e.stopPropagation();
});

// 2. 미니맵 내부 터치 시작 (닫기 전용)
minimapContainer.addEventListener("pointerdown", (e) => {
  isGestureActive = true;
  gestureTarget = "container";
  triggerStartX = e.clientX;
  triggerStartY = e.clientY;
  e.stopPropagation();
});

// 3. 미니맵 외부 화면 터치 시작
window.addEventListener("pointerdown", (e) => {
  // 모달이 열려 있는 상태라면 미니맵 바깥 클릭 판정 자체를 하지 않음
  if (!modal.classList.contains("hidden")) return;

  if (minimapContainer.classList.contains("active") && !minimapContainer.contains(e.target) && !minimapTrigger.contains(e.target)) {
    isGestureActive = true;
    gestureTarget = "outside";
    triggerStartX = e.clientX;
    triggerStartY = e.clientY;
  }
});

// 4. 드래그 방향 감지 (move)
window.addEventListener("pointermove", (e) => {
  if (!isGestureActive) return;

  const dx = e.clientX - triggerStartX;
  const dy = e.clientY - triggerStartY;

  const isMapOpen = minimapContainer.classList.contains("active");

  // [열기]: '우측 상단 모서리(trigger)'에서 시작해 좌측 아래(↙)로 20px 이상 드래그
  if (!isMapOpen && gestureTarget === "trigger" && dx < -20 && dy > 20) {
    setMinimapActive(true);
    isGestureActive = false;
  }

  // [닫기]: '미니맵 영역(container)' 안에서 시작해 우측 위(↗)로 20px 이상 드래그
  if (isMapOpen && gestureTarget === "container" && dx > 20 && dy < -20) {
    setMinimapActive(false);
    isGestureActive = false;
  }
});

// 5. 손가락/마우스를 뗐을 때 (up)
window.addEventListener("pointerup", (e) => {
  if (isGestureActive) {
    const dist = Math.hypot(e.clientX - triggerStartX, e.clientY - triggerStartY);

    // 1) 우측 상단 모서리를 탭/클릭했을 때 열기/닫기 토글
    if (dist < 8 && gestureTarget === "trigger") {
      const isMapOpen = minimapContainer.classList.contains("active");
      setMinimapActive(!isMapOpen);
    }

    // 2) 미니맵 바깥 영역을 단순 클릭/터치(dist < 8) 했을 때만 닫기 (모달이 닫혀있을 때만)
    if (dist < 8 && gestureTarget === "outside" && minimapContainer.classList.contains("active") && modal.classList.contains("hidden")) {
      setMinimapActive(false);
    }
  }

  isGestureActive = false;
  gestureTarget = null;
});
