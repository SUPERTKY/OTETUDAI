
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, push, set, onValue, update, child, get } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
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

const userSelect = document.getElementById('userSelect');
const taskList = document.getElementById('taskList');
const historyList = document.getElementById('historyList');
const newTaskInput = document.getElementById('newTask');
const taskRewardInput = document.getElementById('taskReward');
const addTaskBtn = document.getElementById('addTask');
const requiredInput = document.getElementById('requiredStamps');
const bonusInput = document.getElementById('bonusAmount');
const saveBonusBtn = document.getElementById('saveBonus');
const authStatus = document.getElementById('auth-status');
const stampDisplay = document.getElementById('stampDisplay');

let currentUserId = null;
let bonusConfig = { required: 5, amount: 500 };
let usersData = {};
let tasksData = {};
let currentStamps = 0;

function updateStampDisplay(stamps = currentStamps) {
  currentStamps = stamps;
  const max = bonusConfig.required;
  const filled = '⭐'.repeat(stamps);
  const empty = '☆'.repeat(Math.max(0, max - stamps));
  stampDisplay.textContent = `スタンプ: ${filled}${empty} (${stamps}/${max})`;
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
  }
});

function loadUsers() {
  onValue(ref(db, 'users'), (snapshot) => {
    usersData = snapshot.val() || {};
    userSelect.innerHTML = '';
    Object.entries(usersData).forEach(([id, user]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${user.name} (スタンプ:${user.stamps || 0})`;
      userSelect.appendChild(option);
    });
    if (!currentUserId || !usersData[currentUserId]) {
      currentUserId = userSelect.value;
    }
    userSelect.value = currentUserId;
    currentStamps = usersData[currentUserId]?.stamps || 0;
    updateStampDisplay(currentStamps);
  });
}

userSelect.addEventListener('change', () => {
  currentUserId = userSelect.value;
  currentStamps = usersData[currentUserId]?.stamps || 0;
  updateStampDisplay(currentStamps);
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
    Object.values(histories).forEach(h => {
      const li = document.createElement('li');
      const rewardTxt = h.reward ? ` (${h.reward}円)` : '';
      li.textContent = `${h.userName} が ${h.taskName}${rewardTxt} を実施 (${new Date(h.timestamp).toLocaleString()})`;
      historyList.appendChild(li);
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
  get(userRef).then(snap => {
    const user = snap.val();
    const stamps = (user.stamps || 0) + 1;
    update(userRef, { stamps });
    const histRef = push(ref(db, 'history'));
    set(histRef, {
      userName: user.name,
      taskName,
      reward: tasksData[taskId]?.reward || 0,
      timestamp: Date.now()
    });
    if (stamps >= bonusConfig.required) {
      alert(`${user.name} さんはボーナス達成! ${bonusConfig.amount}円ゲット`);
      update(userRef, { stamps: 0 });
      updateStampDisplay(0);
    } else {
      updateStampDisplay(stamps);
    }
  });
}
