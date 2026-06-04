const PaymentTracker = {
    currentPaymentId: null,
    init() {
        this.renderList();
    },
    renderList() {
        const list = document.getElementById('paymentList');
        if (!AppState.data.payments) AppState.data.payments = [];
        const payments = AppState.data.payments;
        if (payments.length === 0) {
            list.innerHTML = '<div class="empty-state">暂无尾款记录<br>点击右上角 + 添加</div>';
            return;
        }
        const sortedPayments = [...payments].sort((a, b) => new Date(a.balanceDate) - new Date(b.balanceDate));
        list.innerHTML = sortedPayments.map(payment => {
            const balanceDate = new Date(payment.balanceDate);
            const now = new Date();
            const daysLeft = Math.ceil((balanceDate - now) / (1000 * 60 * 60 * 24));
            const isPaid = payment.isPaid || false;
            let statusColor = '#10b981', statusText = '已付款';
            if (!isPaid) {
                if (daysLeft < 0) { statusColor = '#ef4444'; statusText = '已逾期'; }
                else if (daysLeft === 0) { statusColor = '#f59e0b'; statusText = '今天'; }
                else if (daysLeft <= 3) { statusColor = '#f59e0b'; statusText = `${daysLeft}天后`; }
                else { statusColor = '#3b82f6'; statusText = `${daysLeft}天后`; }
            }
            return `<div class="word-item" onclick="PaymentTracker.viewPayment('${payment.id}')" style="border-left: 3px solid ${statusColor};"><div class="word-main"><div class="word-text">${payment.itemName}</div><div class="word-reading">${payment.type} · ${payment.platform}</div></div><div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;"><div style="font-size: 16px; font-weight: 600; color: ${statusColor};">¥${payment.balance.toFixed(2)}</div><div style="font-size: 12px; color: ${statusColor};">${statusText}</div></div></div>`;
        }).join('');
        this.checkReminders();
    },
    addPayment() {
        this.currentPaymentId = null;
        Navigation.goTo('payment-detail');
        document.getElementById('paymentItemName').value = '';
        document.getElementById('paymentType').value = '衣服';
        document.getElementById('paymentPlatform').value = '';
        document.getElementById('paymentDeposit').value = '';
        document.getElementById('paymentBalance').value = '';
        document.getElementById('paymentPurchaseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('paymentBalanceDate').value = '';
        document.getElementById('paymentReminder').checked = true;
        document.getElementById('paymentNotes').value = '';
        this.updateTotal();
    },
    viewPayment(id) {
        const payment = AppState.data.payments.find(p => p.id === id);
        if (!payment) return;
        this.currentPaymentId = id;
        Navigation.goTo('payment-detail');
        document.getElementById('paymentDetailTitle').textContent = payment.itemName;
        document.getElementById('paymentItemName').value = payment.itemName;
        document.getElementById('paymentType').value = payment.type;
        document.getElementById('paymentPlatform').value = payment.platform;
        document.getElementById('paymentDeposit').value = payment.deposit;
        document.getElementById('paymentBalance').value = payment.balance;
        document.getElementById('paymentPurchaseDate').value = payment.purchaseDate;
        document.getElementById('paymentBalanceDate').value = payment.balanceDate;
        document.getElementById('paymentReminder').checked = payment.reminder;
        document.getElementById('paymentNotes').value = payment.notes || '';
        this.updateTotal();
    },
    updateTotal() {
        const deposit = parseFloat(document.getElementById('paymentDeposit').value) || 0;
        const balance = parseFloat(document.getElementById('paymentBalance').value) || 0;
        document.getElementById('paymentTotal').textContent = `¥${(deposit + balance).toFixed(2)}`;
    },
    savePayment() {
        const itemName = document.getElementById('paymentItemName').value.trim();
        if (!itemName) return alert('请输入商品名称');
        const paymentData = {
            itemName, type: document.getElementById('paymentType').value,
            platform: document.getElementById('paymentPlatform').value.trim(),
            deposit: parseFloat(document.getElementById('paymentDeposit').value) || 0,
            balance: parseFloat(document.getElementById('paymentBalance').value) || 0,
            purchaseDate: document.getElementById('paymentPurchaseDate').value,
            balanceDate: document.getElementById('paymentBalanceDate').value,
            reminder: document.getElementById('paymentReminder').checked,
            notes: document.getElementById('paymentNotes').value.trim(),
            isPaid: false
        };
        if (this.currentPaymentId) {
            const payment = AppState.data.payments.find(p => p.id === this.currentPaymentId);
            if (payment) Object.assign(payment, paymentData);
        } else {
            AppState.data.payments.push({ id: Utils.generateId(), ...paymentData, createdAt: Date.now() });
        }
        Utils.saveData();
        Navigation.back('payment-tracker');
        this.renderList();
        alert('✓ 保存成功');
    },
    deletePayment() {
        if (!confirm('确定删除这条记录吗？')) return;
        AppState.data.payments = AppState.data.payments.filter(p => p.id !== this.currentPaymentId);
        Utils.saveData();
        Navigation.back('payment-tracker');
        this.renderList();
    },
    checkReminders() {
        if (!AppState.data.payments) return;
        const now = new Date(), today = now.toDateString();
        AppState.data.payments.forEach(payment => {
            if (payment.reminder && !payment.isPaid) {
                const balanceDate = new Date(payment.balanceDate);
                if (balanceDate.toDateString() === today) this.showNotification(payment);
            }
        });
    },
    showNotification(payment) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('尾款提醒', {
                body: `${payment.itemName} 今天需要付尾款 ¥${payment.balance.toFixed(2)}`,
                icon: './icon-192.png'
            });
        }
    }
};

// 小说翻译模块
