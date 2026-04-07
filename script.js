const QUIZ_LENGTH = 10;
const QUESTION_TIME = 10;
const DATA_PATH = './data/pokemon_gen1_ko_images.json';

const state = {
  pokemonPool: [],
  questions: [],
  currentIndex: 0,
  score: 0,
  remainingTime: QUESTION_TIME,
  timerId: null,
  locked: false,
  audioEnabled: false,
  audioContext: null,
};

const elements = {
  startScreen: document.getElementById('start-screen'),
  quizScreen: document.getElementById('quiz-screen'),
  resultScreen: document.getElementById('result-screen'),
  startButton: document.getElementById('start-button'),
  restartButton: document.getElementById('restart-button'),
  questionProgress: document.getElementById('question-progress'),
  scoreProgress: document.getElementById('score-progress'),
  timerText: document.getElementById('timer-text'),
  pokemonName: document.getElementById('pokemon-name'),
  choices: document.getElementById('choices'),
  feedback: document.getElementById('feedback'),
  finalScore: document.getElementById('final-score'),
  resultMessage: document.getElementById('result-message'),
  progressFill: document.getElementById('progress-fill'),
};

boot();

async function boot() {
  try {
    const response = await fetch(DATA_PATH);
    if (!response.ok) {
      throw new Error('데이터 파일을 불러오지 못했습니다.');
    }

    const raw = await response.json();
    state.pokemonPool = normalizePokemon(raw.items || []);

    if (state.pokemonPool.length < 10) {
      throw new Error('퀴즈에 사용할 포켓몬 데이터가 부족합니다.');
    }

    bindEvents();
  } catch (error) {
    showFatalError(error.message);
  }
}

function bindEvents() {
  elements.startButton.addEventListener('click', startGame);
  elements.restartButton.addEventListener('click', startGame);
}

function normalizePokemon(items) {
  const byDexNumber = new Map();

  for (const item of items) {
    if (!Number.isInteger(item.dex_number) || !item.name_ko || !item.image_url) {
      continue;
    }

    if (item.dex_number < 1 || item.dex_number > 151) {
      continue;
    }

    if (!byDexNumber.has(item.dex_number)) {
      byDexNumber.set(item.dex_number, {
        id: item.dex_number,
        name: item.name_ko,
        image: item.image_url,
      });
    }
  }

  return Array.from(byDexNumber.values()).sort((a, b) => a.id - b.id);
}

function startGame() {
  enableAudio();
  clearTimer();
  state.score = 0;
  state.currentIndex = 0;
  state.questions = createQuizQuestions(state.pokemonPool, QUIZ_LENGTH);
  switchScreen('quiz');
  renderQuestion();
}

function createQuizQuestions(pool, count) {
  const chosen = shuffle([...pool]).slice(0, count);

  return chosen.map((answer) => {
    const distractors = shuffle(pool.filter((pokemon) => pokemon.id !== answer.id)).slice(0, 2);
    const options = shuffle([answer, ...distractors]);
    return { answer, options };
  });
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  if (!question) {
    finishGame();
    return;
  }

  state.locked = false;
  state.remainingTime = QUESTION_TIME;
  elements.feedback.textContent = '';
  elements.feedback.className = 'feedback';
  elements.questionProgress.textContent = `${state.currentIndex + 1} / ${QUIZ_LENGTH}`;
  elements.scoreProgress.textContent = `점수 ${state.score}`;
  elements.pokemonName.textContent = question.answer.name;
  elements.choices.innerHTML = '';
  updateProgressBar();

  question.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-card';
    button.dataset.id = String(option.id);
    button.setAttribute('aria-label', '포켓몬 선택지');
    button.innerHTML = `<img src="${option.image}" alt="포켓몬 선택지" loading="eager" />`;
    button.addEventListener('click', () => handleChoice(option.id));
    elements.choices.appendChild(button);
  });

  updateTimerUI();
  startTimer();
}

function handleChoice(selectedId) {
  if (state.locked) return;

  state.locked = true;
  clearTimer();

  const question = state.questions[state.currentIndex];
  const isCorrect = selectedId === question.answer.id;

  if (isCorrect) {
    state.score += 1;
    elements.scoreProgress.textContent = `점수 ${state.score}`;
    elements.feedback.textContent = '정답입니다! 반짝반짝 잘 맞추셨어요 ✨';
    elements.feedback.className = 'feedback correct';
    playCorrectSound();
  } else {
    elements.feedback.textContent = `앗, 오답이에요! 정답은 ${question.answer.name}였어요.`;
    elements.feedback.className = 'feedback wrong';
    playWrongSound();
  }

  revealAnswer(question.answer.id, selectedId, false);
  window.setTimeout(nextQuestion, 1100);
}

function startTimer() {
  clearTimer();
  state.timerId = window.setInterval(() => {
    state.remainingTime -= 1;
    updateTimerUI();

    if (state.remainingTime <= 0) {
      handleTimeout();
    }
  }, 1000);
}

function updateTimerUI() {
  elements.timerText.textContent = String(state.remainingTime);
  const progress = Math.max(0, state.remainingTime / QUESTION_TIME);
  document.documentElement.style.setProperty('--timer-progress', progress.toString());
}

function updateProgressBar() {
  const progress = ((state.currentIndex + 1) / QUIZ_LENGTH) * 100;
  elements.progressFill.style.width = `${progress}%`;
}

function handleTimeout() {
  if (state.locked) return;

  state.locked = true;
  clearTimer();

  const question = state.questions[state.currentIndex];
  elements.feedback.textContent = `시간 초과예요! 정답은 ${question.answer.name}였어요.`;
  elements.feedback.className = 'feedback wrong';
  playTimeoutSound();
  revealAnswer(question.answer.id, null, true);
  window.setTimeout(nextQuestion, 1200);
}

function revealAnswer(answerId, selectedId, timedOut) {
  const buttons = [...elements.choices.querySelectorAll('.choice-card')];

  buttons.forEach((button) => {
    const optionId = Number(button.dataset.id);
    button.disabled = true;

    if (optionId === answerId) {
      button.classList.add('correct');
    } else if (!timedOut && optionId === selectedId) {
      button.classList.add('wrong');
    } else {
      button.classList.add('dimmed');
    }
  });
}

function nextQuestion() {
  state.currentIndex += 1;

  if (state.currentIndex >= QUIZ_LENGTH) {
    finishGame();
    return;
  }

  renderQuestion();
}

function finishGame() {
  clearTimer();
  switchScreen('result');
  elements.finalScore.textContent = String(state.score);
  elements.resultMessage.textContent = getResultMessage(state.score);

  if (state.score === QUIZ_LENGTH) {
    playPerfectSound();
  } else {
    playFinishSound();
  }
}

function getResultMessage(score) {
  if (score === 10) return '완벽해요! 대표님은 이미 포켓몬 박사급이세요 🏆';
  if (score >= 7) return '오, 꽤 잘 맞히셨어요! 감이 엄청 좋으신데요?';
  if (score >= 4) return '좋아요! 한 판만 더 하면 더 높은 점수 바로 노릴 수 있어요.';
  return '괜찮아요! 다시 하면 금방 감 잡으실 거예요 😎';
}

function switchScreen(screen) {
  elements.startScreen.classList.toggle('active', screen === 'start');
  elements.quizScreen.classList.toggle('active', screen === 'quiz');
  elements.resultScreen.classList.toggle('active', screen === 'result');
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function showFatalError(message) {
  switchScreen('start');
  elements.startScreen.innerHTML = `
    <div class="badge">ERROR</div>
    <h1>앗, 준비 중에 문제가 생겼어요</h1>
    <p class="lead">${message}<br />로컬 서버 또는 GitHub Pages 배포 상태를 확인해 주세요.</p>
  `;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function enableAudio() {
  if (state.audioEnabled) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  state.audioContext = new AudioContextClass();
  state.audioEnabled = true;

  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume().catch(() => {});
  }
}

function playCorrectSound() {
  playSequence([
    { type: 'triangle', frequency: 523.25, duration: 0.09, gain: 0.03 },
    { type: 'triangle', frequency: 659.25, duration: 0.09, gain: 0.035, delay: 0.08 },
    { type: 'triangle', frequency: 783.99, duration: 0.12, gain: 0.04, delay: 0.16 },
  ]);
}

function playWrongSound() {
  playSequence([
    { type: 'sawtooth', frequency: 260, duration: 0.12, gain: 0.028 },
    { type: 'sawtooth', frequency: 180, duration: 0.18, gain: 0.026, delay: 0.1 },
  ]);
}

function playTimeoutSound() {
  playSequence([
    { type: 'square', frequency: 330, duration: 0.1, gain: 0.02 },
    { type: 'square', frequency: 247, duration: 0.12, gain: 0.018, delay: 0.08 },
    { type: 'square', frequency: 196, duration: 0.15, gain: 0.018, delay: 0.16 },
  ]);
}

function playFinishSound() {
  playSequence([
    { type: 'sine', frequency: 392, duration: 0.08, gain: 0.03 },
    { type: 'sine', frequency: 493.88, duration: 0.08, gain: 0.03, delay: 0.08 },
    { type: 'sine', frequency: 587.33, duration: 0.12, gain: 0.035, delay: 0.16 },
  ]);
}

function playPerfectSound() {
  playSequence([
    { type: 'triangle', frequency: 523.25, duration: 0.08, gain: 0.03 },
    { type: 'triangle', frequency: 659.25, duration: 0.08, gain: 0.035, delay: 0.07 },
    { type: 'triangle', frequency: 783.99, duration: 0.08, gain: 0.035, delay: 0.14 },
    { type: 'triangle', frequency: 1046.5, duration: 0.16, gain: 0.04, delay: 0.21 },
  ]);
}

function playSequence(notes) {
  if (!state.audioContext) return;

  const now = state.audioContext.currentTime;
  notes.forEach((note) => {
    const oscillator = state.audioContext.createOscillator();
    const gainNode = state.audioContext.createGain();
    const start = now + (note.delay || 0);
    const end = start + note.duration;

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, start);

    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(note.gain || 0.03, start + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gainNode);
    gainNode.connect(state.audioContext.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}
