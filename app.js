import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, push, set, onValue, update, child, get, runTransaction, remove } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
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
let authStatus;
let stampDisplay;
let allowanceDisplay;
let payAllowanceBtn;
let loginSection;
let passwordInput;
let loginBtn;
let loginError;
let mainSection;
let dbPassword = '';

const DEFAULT_USER_ID = 'default';
let currentUserId = DEFAULT_USER_ID;
let userName = '子ども';
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
  authStatus = document.getElementById('auth-status');
  stampDisplay = document.getElementById('stampDisplay');
  allowanceDisplay = document.getElementById('allowanceDisplay');
  payAllowanceBtn = document.getElementById('payAllowance');
  loginSection = document.getElementById('loginSection');
  passwordInput = document.getElementById('passwordInput');
  loginBtn = document.getElementById('loginBtn');
  loginError = document.getElementById('loginError');
  mainSection = document.getElementById('main');

  signInAnonymously(auth).catch(console.error);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      authStatus.textContent = 'ログイン済み';
      loadPassword();
    }
  });

  addTaskBtn?.addEventListener('click', handleAddTask);
  payAllowanceBtn?.addEventListener('click', handlePayAllowance);
  loginBtn?.addEventListener('click', handleLogin);
}

function updateStampDisplay(stamps = currentStamps) {

}

function updateAllowanceDisplay(amount = currentAllowance) {
  currentAllowance = amount;
  allowanceDisplay.textContent = `たまったお小遣い: ${amount}円`;
}

function loadPassword() {
  get(ref(db, 'password')).then(snapshot => {
    dbPassword = snapshot.val() || '';
  });
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
      const delBtn = document.createElement('button');
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', () => deleteTask(id));
      li.appendChild(delBtn);
      taskList.appendChild(li);
    });
  });
}

function loadHistory() {
  onValue(ref(db, 'history'), (snapshot) => {
    const histories = snapshot.val() || {};
    historyList.innerHTML = '';
    Object.entries(histories)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .forEach(([key, h]) => {
        const li = document.createElement('li');
        const rewardTxt = h.reward ? ` (${h.reward}円)` : '';
        li.textContent = `${h.userName} が ${h.taskName}${rewardTxt} を実施 (${new Date(h.timestamp).toLocaleString()})`;
        const delBtn = document.createElement('button');
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', () => deleteHistoryItem(key, h.reward));
        li.appendChild(delBtn);
        historyList.appendChild(li);
      });
  });
}

function loadPayments() {
  onValue(ref(db, 'payments'), (snapshot) => {
    const payments = snapshot.val() || {};
    paymentList.innerHTML = '';
    Object.entries(payments)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .forEach(([key, p]) => {
        const li = document.createElement('li');
        li.textContent = `${p.userName} に ${p.amount}円 渡した (${new Date(p.timestamp).toLocaleString()})`;
        const delBtn = document.createElement('button');
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', () => deletePaymentItem(key));
        li.appendChild(delBtn);
        paymentList.appendChild(li);
      });
  });
}

function deletePaymentItem(key) {
  // 支払い履歴の削除は残高に影響を与えない
  remove(ref(db, `payments/${key}`));
}

function handleLogin() {
  const input = passwordInput.value;
  if (input === dbPassword) {
    loginSection.style.display = 'none';
    mainSection.style.display = 'block';
    loadUser();
    loadTasks();
    loadHistory();
    loadPayments();
    passwordInput.value = '';
    loginError.textContent = '';
  } else {
    loginError.textContent = 'パスワードが違います';
  }
}

function recordTask(taskId, taskName) {
  if (!currentUserId) return;
  const userRef = ref(db, `users/${currentUserId}`);
  const reward = Number(tasksData[taskId]?.reward) || 0;
  runTransaction(userRef, user => {
      if (!user) {
        user = { name: userName, stamps: 0, allowance: 0 };
      }
    user.stamps = Number(user.stamps || 0) + 1;
    user.allowance = Number(user.allowance || 0) + reward;
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

function deleteHistoryItem(key, reward = 0) {
  const userRef = ref(db, `users/${DEFAULT_USER_ID}`);
  runTransaction(userRef, user => {
    if (!user) return user;
    user.stamps = Math.max(0, Number(user.stamps || 0) - 1);
    user.allowance = Math.max(0, Number(user.allowance || 0) - Number(reward || 0));
    return user;
  }).then(result => {
    const user = result.snapshot.val();
    updateStampDisplay(user.stamps);
    updateAllowanceDisplay(user.allowance);
    set(ref(db, `history/${key}`), null);
  });
}

function deleteTask(taskId) {
  set(ref(db, `tasks/${taskId}`), null);
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
      // 支払い完了時にやった！履歴をリセットする
      set(ref(db, 'history'), null);
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
