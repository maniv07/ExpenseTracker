const balance = document.getElementById('balance');
const incomeEl = document.getElementById('income');
const expenseEl = document.getElementById('expense');
const list = document.getElementById('list');
const form = document.getElementById('form');
const text = document.getElementById('text');
const amount = document.getElementById('amount');
const type = document.getElementById('type');

let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

function updateUI() {
    list.innerHTML = '';

    let income = 0;
    let expense = 0;

    transactions.forEach((t, index) => {
        const li = document.createElement('li');
        li.classList.add('list-group-item', t.type);

        li.innerHTML = `
            ${t.text} <span>₹${t.amount}</span>
            <button class="delete-btn" onclick="deleteTransaction(${index})">×</button>
        `;

        list.appendChild(li);

        t.type === 'income'
            ? income += t.amount
            : expense += t.amount;
    });

    balance.innerText = `₹${income - expense}`;
    incomeEl.innerText = `₹${income}`;
    expenseEl.innerText = `₹${expense}`;

    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function addTransaction(e) {
    e.preventDefault();

    const transaction = {
        text: text.value,
        amount: +amount.value,
        type: type.value
    };

    transactions.push(transaction);
    updateUI();

    text.value = '';
    amount.value = '';
}

function deleteTransaction(index) {
    transactions.splice(index, 1);
    updateUI();
}

form.addEventListener('submit', addTransaction);

updateUI();
