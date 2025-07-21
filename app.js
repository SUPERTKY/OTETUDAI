import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, push, set, onValue, update, child, get, runTransaction } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDGDZlMJOo4ywROtY2h0LSbOaH6iKd8sNU",
  authDomain: "otetudai-d5648.firebaseapp.com",
  databaseURL: "https://otetudai-d5648-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "otetudai-d5648",
  storageBucket: "otetudai-d5648.firebasestorage.app",
  messagingSenderId: "233599253049",
  appId: "1:233599253049:web:b82a435b59cbd739512be8"
};



const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

let taskList;
let historyList;
let paymentList;
let newTaskInput;
let taskRewardInput;
let addTaskBtn;
let requiredInput;
let bonusInput;
let saveBonusBtn;
let authStatus;
let stampDisplay;
let allowanceDisplay;
let payAllowanceBtn;

const DEFAULT_USER_ID = 'default';
let currentUserId = DEFAULT_USER_ID;
let userName = '子ども';
let bonusConfig = { required: 5, amount: 500 };
let tasksData = {};
let currentStamps = 0;
let currentAllowance = 0;

function init() {
  taskList = document.getElementById('taskList');
  historyList = document.getElementById('historyList');
  paymentList = document.getElementById('paymentList');
  newTaskInput = document.getElementById('newTask');
  taskRewardInput = document.getElementById('taskReward');
  addTaskBtn = document.getElementById('addTask');
  requiredInput = document.getElementById('requiredStamps');
  bonusInput = document.getElementById('bonusAmount');
  saveBonusBtn = document.getElementById('saveBonus');
  authStatus = document.getElementById('auth-status');
  stampDisplay = document.getElementById('stampDisplay');
  allowanceDisplay = document.getElementById('allowanceDisplay');
  payAllowanceBtn = document.getElementById('payAllowance');

  signInAnonymously(auth).catch(console.error);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      authStatus.textContent = 'ログイン済み';
      loadUser();
      loadTasks();
      loadBonus();
      loadHistory();
      loadPayments();
    }
  });

  addTaskBtn?.addEventListener('click', handleAddTask);
  saveBonusBtn?.addEventListener('click', handleSaveBonus);
  payAllowanceBtn?.addEventListener('click', handlePayAllowance);
}

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


function loadUser() {
  onValue(ref(db, `users/${DEFAULT_USER_ID}`), (snapshot) => {
    const user = snapshot.val() || { name: userName, stamps: 0, allowance: 0 };
    userName = user.name;
    currentStamps = user.stamps || 0;
    updateStampDisplay(currentStamps);
    currentAllowance = user.allowance || 0;
    updateAllowanceDisplay(currentAllowance);
  });
}

function loadTasks() {
  onValue(ref(db, 'tasks'), (snapshot) => {
    tasksData = snapshot.val() || {};
    taskList.innerHTML = '';
    Object.entries(tasksData).forEach(([id, task]) => {
      if (task.reward === undefined) {
        update(ref(db, `tasks/${id}`), { reward: 0 });
        task.reward = 0;
      }
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


function recordTask(taskId, taskName) {
  if (!currentUserId) return;
  const userRef = ref(db, `users/${currentUserId}`);
  const reward = Number(tasksData[taskId]?.reward) || 0;
  let bonusEarned = false;
    runTransaction(userRef, user => {
      if (!user) {
        user = { name: userName, stamps: 0, allowance: 0 };
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

function handleAddTask() {
  const name = newTaskInput.value.trim();
  const reward = Number(taskRewardInput.value) || 0;
  if (!name) return;
  const newRef = push(ref(db, 'tasks'));
  set(newRef, { name, reward });
  newTaskInput.value = '';
  taskRewardInput.value = '';
}

function handleSaveBonus() {
  bonusConfig = {
    required: Number(requiredInput.value),
    amount: Number(bonusInput.value)
  };
  set(ref(db, 'bonus'), bonusConfig);
  updateStampDisplay(currentStamps);
}

function handlePayAllowance() {
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
}

window.addEventListener('DOMContentLoaded', init);
