import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, push, set, onValue, update, child, get, runTransaction } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';

// Firebase設定
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

const userSelect = document.getElementById('userSelect');
const taskList = document.getElementById('taskList');
const historyList = document.getElementById('historyList');
const paymentList = document.getElementById('paymentList');
const newTaskInput = document.getElementById('newTask');
const taskRewardInput = document.getElementById('taskReward');
const addTaskBtn = document.getElementById('addTask');
const requiredInput = document.getElementById('requiredStamps');
const bonusInput = document.getElementById('bonusAmount');
const saveBonusBtn = document.getElementById('saveBonus');
const authStatus = document.getElementById('auth-status');
const stampDisplay = document.getElementById('stampDisplay');
const allowanceDisplay = document.getElementById('allowanceDisplay');
const payAllowanceBtn = document.getElementById('payAllowance');

let currentUserId = null;
let bonusConfig = { required: 5, amount: 500 };
let usersData = {};
let tasksData = {};
let currentStamps = 0;
let currentAllowance = 0;

function updateStampDisplay(stamps = currentStamps) {
  currentStamps = stamps;
  const max = bonusConfig.required;
  const filled = '⭐'.repeat(stamps);
  const empty = '☆'.repeat(Math.max(0, max - stamps));
  stampDisplay.textContent = `スタンプ: ${filled}${empty} (${stamps}/${max})`;
}

function updateAllowanceDisplay(amount = currentAllowance) {
  currentAllowance = amount;
  allowanceDisplay.textContent = `たまったお小遣い: ${amount}円`;
}

signInAnonymously(auth)
  .catch(console.error);

onAuthStateChanged(auth, (user) => {
  if (user) {
    authStatus.textContent = 'ログイン済み';
    loadUsers();
    loadTasks();
    loadBonus();
    loadHistory();
    loadPayments();
  }
});

function loadUsers() {
  onValue(ref(db, 'users'), (snapshot) => {
    usersData = snapshot.val() || {};
    userSelect.innerHTML = '';
    Object.entries(usersData).forEach(([id, user]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${user.name} (スタンプ:${user.stamps || 0} お小遣い:${user.allowance || 0}円)`;
      userSelect.appendChild(option);
    });
    if (!currentUserId || !usersData[currentUserId]) {
      currentUserId = userSelect.value;
    }
    userSelect.value = currentUserId;
    currentStamps = usersData[currentUserId]?.stamps || 0;
    updateStampDisplay(currentStamps);
    currentAllowance = usersData[currentUserId]?.allowance || 0;
    updateAllowanceDisplay(currentAllowance);
  });
}

userSelect.addEventListener('change', () => {
  currentUserId = userSelect.value;
  currentStamps = usersData[currentUserId]?.stamps || 0;
  updateStampDisplay(currentStamps);
  currentAllowance = usersData[currentUserId]?.allowance || 0;
  updateAllowanceDisplay(currentAllowance);
});

function loadTasks() {
  onValue(ref(db, 'tasks'), (snapshot) => {
    tasksData = snapshot.val() || {};
    taskList.innerHTML = '';
    Object.entries(tasksData).forEach(([id, task]) => {
      const li = document.createElement('li');
      li.textContent = `${task.name} (${task.reward || 0}円)`;
      const doneBtn = document.createElement('button');
      doneBtn.textContent = 'やった!';
      doneBtn.addEventListener('click', () => recordTask(id, task.name));
      li.appendChild(doneBtn);
      taskList.appendChild(li);
    });
  });
}

function loadHistory() {
  onValue(ref(db, 'history'), (snapshot) => {
    const histories = snapshot.val() || {};
    historyList.innerHTML = '';
    Object.values(histories)
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(h => {
        const li = document.createElement('li');
        const rewardTxt = h.reward ? ` (${h.reward}円)` : '';
        li.textContent = `${h.userName} が ${h.taskName}${rewardTxt} を実施 (${new Date(h.timestamp).toLocaleString()})`;
        historyList.appendChild(li);
      });
  });
}

function loadPayments() {
  onValue(ref(db, 'payments'), (snapshot) => {
    const payments = snapshot.val() || {};
    paymentList.innerHTML = '';
    Object.values(payments)
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.userName} に ${p.amount}円 渡した (${new Date(p.timestamp).toLocaleString()})`;
        paymentList.appendChild(li);
      });
  });
}

function loadBonus() {
  onValue(ref(db, 'bonus'), (snapshot) => {
    bonusConfig = snapshot.val() || bonusConfig;
    requiredInput.value = bonusConfig.required;
    bonusInput.value = bonusConfig.amount;
    updateStampDisplay(currentStamps);
  });
}

addTaskBtn.addEventListener('click', () => {
  const name = newTaskInput.value.trim();
  const reward = Number(taskRewardInput.value) || 0;
  if (!name) return;
  const newRef = push(ref(db, 'tasks'));
  set(newRef, { name, reward });
  newTaskInput.value = '';
  taskRewardInput.value = '';
});

saveBonusBtn.addEventListener('click', () => {
  bonusConfig = {
    required: Number(requiredInput.value),
    amount: Number(bonusInput.value)
  };
  set(ref(db, 'bonus'), bonusConfig);
  updateStampDisplay(currentStamps);
});

function recordTask(taskId, taskName) {
  if (!currentUserId) return;
  const userRef = ref(db, `users/${currentUserId}`);
  const reward = Number(tasksData[taskId]?.reward) || 0;
  let bonusEarned = false;
  runTransaction(userRef, user => {
    if (!user) {
      user = { name: usersData[currentUserId]?.name || 'unknown', stamps: 0, allowance: 0 };
    }
    user.stamps = Number(user.stamps || 0) + 1;
    user.allowance = Number(user.allowance || 0) + reward;
    if (user.stamps >= bonusConfig.required) {
      user.stamps = 0;
      user.allowance += bonusConfig.amount;
      bonusEarned = true;
    }
    return user;
  }).then(result => {
    const user = result.snapshot.val();
    const histRef = push(ref(db, 'history'));
    set(histRef, {
      userName: user.name,
      taskName,
      reward,
      timestamp: Date.now()
    });
    limitList('history');
    updateStampDisplay(user.stamps);
    updateAllowanceDisplay(user.allowance);
    if (bonusEarned) {
      alert(`${user.name} さんはボーナス達成! ${bonusConfig.amount}円ゲット`);
    }
  });
}

function limitList(path, limit = 10) {
  get(ref(db, path)).then(snapshot => {
    const data = snapshot.val() || {};
    const entries = Object.entries(data).sort((a, b) => a[1].timestamp - b[1].timestamp);
    while (entries.length > limit) {
      const [key] = entries.shift();
      set(ref(db, `${path}/${key}`), null);
    }
  });
}

payAllowanceBtn.addEventListener('click', () => {
  if (!currentUserId) return;
  const userRef = ref(db, `users/${currentUserId}`);
  let amount = 0;
  runTransaction(userRef, user => {
    if (!user) return user;
    amount = Number(user.allowance) || 0;
    user.allowance = 0;
    return user;
  }).then(result => {
    const user = result.snapshot.val();
    updateAllowanceDisplay(0);
    if (amount > 0) {
      const pRef = push(ref(db, 'payments'));
      set(pRef, { userName: user.name, amount, timestamp: Date.now() });
      limitList('payments');
    }
  });
});
