// =====================================================
// TravelAccount Module — 旅行记账工具
// Adapted from standalone travel.html into Perigee OS
// =====================================================

const TravelAccount = {
    // --- State ---
    config: { targetCurrency: 'CNY', customCode: '', rateUnit: 1 },
    expenses: [],
    people: ['我', '队友'],
    families: [],
    settlementLog: [],
    externalSettlementLog: [],

    CURRENCY_SYMBOLS: {
        'JPY': '¥', 'CNY': '¥', 'USD': '$', 'EUR': '€',
        'KRW': '₩', 'THB': '฿', 'GBP': '£', 'SGD': '$', 'MYR': 'RM'
    },

    // --- Init ---
    init() {
        // Load saved data from AppState
        const saved = AppState.data.travelData;
        if (saved) {
            this.config = saved.config || this.config;
            this.expenses = saved.expenses || [];
            this.people = saved.people || ['我', '队友'];
            this.families = saved.families || [];
        }

        // Set today's date
        const dateInput = document.getElementById('ta-date');
        if (dateInput) dateInput.valueAsDate = new Date();

        // Restore currency selection
        const sel = document.getElementById('ta-targetCurrency');
        if (sel) {
            if (this.config.targetCurrency === 'CUSTOM') {
                sel.value = 'CUSTOM';
                const ci = document.getElementById('ta-customCodeInput');
                if (ci) ci.value = this.config.customCode || '';
            } else {
                sel.value = this.config.targetCurrency;
            }
        }

        this.handleCurrencyChange(false);
        this.renderPeopleUI();
        this.renderFamiliesUI();
        this.renderTable();
        this.updateSummary();
    },

    save() {
        AppState.data.travelData = {
            config: this.config,
            expenses: this.expenses,
            people: this.people,
            families: this.families
        };
        Utils.saveData();
    },

    // --- Currency ---
    handleCurrencyChange(resetRate = true) {
        const val = document.getElementById('ta-targetCurrency').value;
        const customPanel = document.getElementById('ta-customCurrencyPanel');
        const refreshBtn = document.getElementById('ta-refreshRateBtn');
        if (val === 'CUSTOM') {
            customPanel.style.display = 'block';
            this.config.targetCurrency = 'CUSTOM';
            refreshBtn.style.display = 'none';
        } else {
            customPanel.style.display = 'none';
            refreshBtn.style.display = 'inline-block';
            let unit = ['JPY', 'KRW', 'VND'].includes(val) ? 100 : 1;
            this.config.targetCurrency = val;
            this.config.rateUnit = unit;
            this.config.customCode = '';
            this.updateCurrencyUI(val, unit, resetRate);
        }
        this.save();
    },

    saveCustomCurrency() {
        const code = document.getElementById('ta-customCodeInput').value.toUpperCase().trim();
        const rate = parseFloat(document.getElementById('ta-customRateInput').value);
        if (!code || !rate) { Utils.showToast(I18n.t('t.travel_fill_code_rate', '请输入完整的代码和汇率')); return; }
        this.config.targetCurrency = 'CUSTOM';
        this.config.customCode = code;
        this.config.rateUnit = 1;
        this.save();
        this.updateCurrencyUI(code, 1, false);
        document.getElementById('ta-exchangeRate').value = rate;
        document.getElementById('ta-customCurrencyPanel').style.display = 'none';
        Utils.showToast(I18n.t('t.travel_applied', {code, rate}));
    },

    updateCurrencyUI(code, unit, fetchNewRate) {
        const rateCard = document.getElementById('ta-rateCard');
        const currencySelect = document.getElementById('ta-currency');
        const rateUnitDisplay = document.getElementById('ta-rateUnitDisplay');
        if (code === 'CNY' && this.config.targetCurrency !== 'CUSTOM') {
            rateCard.style.display = 'none';
            rateUnitDisplay.value = '无需汇率';
            currencySelect.innerHTML = `<option value="CNY">¥ 人民币</option>`;
            document.getElementById('ta-exchangeRate').value = 1;
        } else {
            rateCard.style.display = 'block';
            rateUnitDisplay.value = `基数: ${unit}`;
            document.getElementById('ta-rateLabel').innerText = `${code} 汇率:`;
            const symbol = this.CURRENCY_SYMBOLS[code] || code;
            currencySelect.innerHTML = `<option value="${code}">${symbol} 当地货币</option><option value="CNY">¥ 人民币</option>`;
            if (fetchNewRate && this.config.targetCurrency !== 'CUSTOM') this.fetchRate();
        }
    },

    async fetchRate() {
        const code = this.config.targetCurrency;
        if (code === 'CNY' || code === 'CUSTOM') return;
        const btn = document.getElementById('ta-refreshRateBtn');
        btn.innerHTML = '<svg class="ta-inline-icon ta-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>';
        try {
            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${code}`);
            const data = await response.json();
            const rateOne = data.rates.CNY;
            document.getElementById('ta-exchangeRate').value = parseFloat((rateOne * this.config.rateUnit).toFixed(4));
        } catch (error) {
            Utils.showToast(I18n.t('t.travel_network_issue', '网络有点小问题，请手动输入汇率'));
        } finally {
            btn.innerHTML = '<svg class="ta-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
        }
    },

    // --- People ---
    renderPeopleUI() {
        const listDiv = document.getElementById('ta-personList');
        const payerSelect = document.getElementById('ta-payer');
        const familyRepSelect = document.getElementById('ta-familyRep');
        const familyMembersChecklist = document.getElementById('ta-familyMembersChecklist');
        listDiv.innerHTML = '';
        payerSelect.innerHTML = '';
        familyRepSelect.innerHTML = '';
        familyMembersChecklist.innerHTML = '';

        this.people.forEach((p, index) => {
            listDiv.innerHTML += `<div class="ta-person-tag">${p} <span class="ta-remove" onclick="TravelAccount.removePerson(${index})">×</span></div>`;
            payerSelect.innerHTML += `<option value="${p}">${p}</option>`;
            familyRepSelect.innerHTML += `<option value="${p}">${p}</option>`;
            familyMembersChecklist.innerHTML += `<label class="ta-check-item"><input type="checkbox" value="${p}" id="ta-memberCheck${index}"> ${p}</label>`;
        });
        document.getElementById('ta-familyManagementCard').style.display = this.people.length > 1 ? 'block' : 'none';
        this.renderSplitPanel();
    },

    addPerson() {
        const input = document.getElementById('ta-newPersonName');
        const name = input.value.trim();
        if (name && !this.people.includes(name)) {
            this.people.push(name);
            this.save();
            this.renderPeopleUI();
            this.updateSummary();
            input.value = '';
        }
    },

    removePerson(index) {
        if (this.people.length <= 1) { Utils.showToast(I18n.t('t.travel_keep_one_traveler', '至少留一位旅伴哦')); return; }
        const personToRemove = this.people[index];
        if (confirm(`移除 "${personToRemove}"？\n注意：如果此人属于某个家庭，也需要您稍后手动更新家庭信息。`)) {
            this.people.splice(index, 1);
            this.families.forEach(family => {
                family.members = family.members.filter(m => m !== personToRemove);
                if (family.rep === personToRemove) family.rep = family.members[0] || '';
            });
            this.families = this.families.filter(f => f.members.length > 0);
            this.save();
            this.renderPeopleUI();
            this.renderFamiliesUI();
            this.updateSummary();
        }
    },

    // --- Families ---
    renderFamiliesUI() {
        const listDiv = document.getElementById('ta-familyList');
        listDiv.innerHTML = '';
        if (this.families.length === 0) {
            listDiv.innerHTML = '<div class="ta-text-center ta-text-muted ta-small" style="padding:8px 0;">暂无家庭</div>';
            return;
        }
        this.families.forEach((family, index) => {
            listDiv.innerHTML += `
                <div class="ta-family-card">
                    <div class="ta-family-header">
                        <h6>${family.name} <span class="ta-badge ta-badge-shared" style="margin-left:6px;">${family.members.length}人</span></h6>
                        <div class="ta-family-actions">
                            <button class="ta-btn-sm ta-btn-outline" onclick="TravelAccount.editFamily(${index})">编辑</button>
                            <button class="ta-btn-sm ta-btn-danger" onclick="TravelAccount.removeFamily(${index})">删除</button>
                        </div>
                    </div>
                    <div class="ta-small ta-mt-3"><strong>代表:</strong> ${family.rep}</div>
                    <div class="ta-small ta-text-muted" style="margin-top:2px;"><strong>成员:</strong> ${family.members.join(', ')}</div>
                </div>`;
        });
    },

    createFamily() {
        const nameInput = document.getElementById('ta-familyName');
        const name = nameInput.value.trim();
        const rep = document.getElementById('ta-familyRep').value;
        const memberCheckboxes = document.querySelectorAll('#ta-familyMembersChecklist input:checked');
        const members = Array.from(memberCheckboxes).map(cb => cb.value);
        const editingIndex = nameInput.dataset.editingIndex;

        if (!name || !rep || members.length === 0) { Utils.showToast(I18n.t('t.travel_family_fields_required', '家庭名称、代表和成员都不能为空')); return; }
        if (!members.includes(rep)) { Utils.showToast(I18n.t('t.travel_rep_must_be_member', '家庭代表必须是家庭成员之一')); return; }

        const newFamily = { name, rep, members };
        if (editingIndex !== undefined && editingIndex !== '') {
            this.families[editingIndex] = newFamily;
        } else {
            if (this.families.some(f => f.name === name)) { Utils.showToast(I18n.t('t.travel_family_name_exists', '已存在同名家庭')); return; }
            this.families.push(newFamily);
        }
        this.save();
        this.renderFamiliesUI();
        this.updateSummary();
        nameInput.value = '';
        nameInput.dataset.editingIndex = '';
        memberCheckboxes.forEach(cb => cb.checked = false);
    },

    editFamily(index) {
        const family = this.families[index];
        document.getElementById('ta-familyName').value = family.name;
        document.getElementById('ta-familyName').dataset.editingIndex = index;
        document.getElementById('ta-familyRep').value = family.rep;
        document.querySelectorAll('#ta-familyMembersChecklist input').forEach(cb => {
            cb.checked = family.members.includes(cb.value);
        });
        // Expand family panel
        const panel = document.getElementById('ta-familyPanel');
        if (panel) panel.classList.add('ta-show');
        document.getElementById('ta-familyManagementCard').scrollIntoView({ behavior: 'smooth' });
    },

    removeFamily(index) {
        if (confirm(`确认删除家庭 "${this.families[index].name}"？`)) {
            this.families.splice(index, 1);
            this.save();
            this.renderFamiliesUI();
            this.updateSummary();
        }
    },

    // --- Collapse toggle ---
    toggleCollapse(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.toggle('ta-show');
    },

    // --- Split / Purchasing ---
    toggleSplitPanel() {
        const useSplit = document.getElementById('ta-useSplit').checked;
        const amountInput = document.getElementById('ta-amount');
        document.getElementById('ta-splitPanel').style.display = useSplit ? 'block' : 'none';
        if (useSplit) {
            amountInput.readOnly = true;
            this.renderSplitPanel();
            this.updateSplitTotal();
        } else {
            amountInput.readOnly = false;
        }
    },

    renderSplitPanel() {
        const detailsDiv = document.getElementById('ta-splitDetails');
        if (detailsDiv.innerHTML.trim() === '') {
            this.people.forEach(p => {
                detailsDiv.insertAdjacentHTML('beforeend', this._createSplitInputHTML(p));
            });
        }
    },

    _createSplitInputHTML(name) {
        return `<div class="ta-input-group ta-mb-2">
            <span class="ta-input-prepend" style="min-width:80px; overflow:hidden; text-overflow:ellipsis;">${name}</span>
            <input type="number" class="ta-input ta-split-amount-input" placeholder="0.00" data-person="${name}" oninput="TravelAccount.updateSplitTotal()">
        </div>`;
    },

    addCustomSplitPerson() {
        const name = prompt('请输入代购人/朋友的昵称：');
        if (name && name.trim() !== '') {
            document.getElementById('ta-splitDetails').insertAdjacentHTML('beforeend', this._createSplitInputHTML(name.trim()));
        }
    },

    updateSplitTotal() {
        let total = 0;
        document.querySelectorAll('#travel-account .ta-split-amount-input').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        document.getElementById('ta-amount').value = total.toFixed(2);
    },

    // --- Add Expense ---
    addExpense() {
        if (this.people.length === 0) { Utils.showToast(I18n.t('t.travel_add_traveler_first', '请先添加旅伴')); return; }
        const date = document.getElementById('ta-date').value;
        const item = document.getElementById('ta-item').value;
        const payer = document.getElementById('ta-payer').value;
        const currency = document.getElementById('ta-currency').value;
        const amount = parseFloat(document.getElementById('ta-amount').value);
        let inputRate = parseFloat(document.getElementById('ta-exchangeRate').value);
        let activeCurrencyCode = this.config.targetCurrency === 'CUSTOM' ? this.config.customCode : this.config.targetCurrency;
        if (this.config.targetCurrency === 'CNY') { activeCurrencyCode = 'CNY'; inputRate = 1; }
        if (!date || !item || !amount) { Utils.showToast(I18n.t('t.travel_info_incomplete', '信息不完整哦')); return; }
        if (!inputRate) { Utils.showToast(I18n.t('t.travel_rate_not_set', '汇率似乎没设置好')); return; }

        let finalCNY = (currency === 'CNY') ? amount : (amount / this.config.rateUnit) * inputRate;
        let recordedRate = (currency === 'CNY') ? 1.0 : inputRate;
        const useSplit = document.getElementById('ta-useSplit').checked;
        const isPrivate = useSplit && document.getElementById('ta-isPrivatePurchase').checked;
        let expenseType = 'shared';
        let splitDetails = {};
        if (useSplit) {
            expenseType = 'split';
            document.querySelectorAll('#travel-account .ta-split-amount-input').forEach(input => {
                const person = input.dataset.person;
                const personAmount = parseFloat(input.value) || 0;
                if (personAmount > 0) splitDetails[person] = personAmount;
            });
        }

        this.expenses.push({
            id: Date.now(), date, item, payer,
            currency: currency === 'CNY' ? 'CNY' : activeCurrencyCode,
            amount, rate: recordedRate, unit: this.config.rateUnit,
            finalCNY: parseFloat(finalCNY.toFixed(2)),
            type: expenseType, splitDetails, isPrivate
        });
        this.save();
        this.renderTable();
        this.updateSummary();

        // Reset form
        document.getElementById('ta-item').value = '';
        document.getElementById('ta-amount').value = '';
        document.getElementById('ta-useSplit').checked = false;
        document.getElementById('ta-splitDetails').innerHTML = '';
        this.toggleSplitPanel();
    },

    // --- Table ---
    renderTable() {
        const tbody = document.getElementById('ta-tableBody');
        tbody.innerHTML = '';
        if (this.expenses.length === 0) {
            document.getElementById('ta-emptyState').style.display = 'block';
            return;
        }
        document.getElementById('ta-emptyState').style.display = 'none';
        const sorted = [...this.expenses].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
        sorted.forEach(exp => {
            const dateStr = new Date(exp.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
            const symbol = this.CURRENCY_SYMBOLS[exp.currency] || exp.currency;
            let rateInfo = exp.currency !== 'CNY' ? `<div class="ta-rate-hint">@ ${exp.rate}</div>` : '';
            let typeBadge = '';
            if (exp.isPrivate) typeBadge = '<span class="ta-badge ta-badge-private">个人/代购</span>';
            else if (exp.type === 'split') typeBadge = '<span class="ta-badge ta-badge-split">指定分摊</span>';
            else typeBadge = '<span class="ta-badge ta-badge-shared">平均分摊</span>';

            tbody.innerHTML += `
                <tr>
                    <td><div class="ta-item-name">${exp.item}</div><div class="ta-item-date">${dateStr}</div></td>
                    <td><div>${exp.payer}</div><div>${typeBadge}</div></td>
                    <td><div class="ta-amount-foreign">${symbol} ${exp.amount.toFixed(2)}</div>${rateInfo}</td>
                    <td class="ta-amount-cny">${exp.finalCNY.toFixed(2)}</td>
                    <td class="ta-text-end"><button class="ta-delete-btn" onclick="TravelAccount.deleteExpense(${exp.id})">×</button></td>
                </tr>`;
        });
    },

    // --- Summary & Settlement ---
    updateSummary() {
        let payerTotals = {};
        let balances = {};
        let externalDebts = {};
        this.people.forEach(p => { payerTotals[p] = 0; balances[p] = 0; });

        this.expenses.forEach(exp => {
            if (payerTotals.hasOwnProperty(exp.payer)) {
                payerTotals[exp.payer] += exp.finalCNY;
                balances[exp.payer] += exp.finalCNY;
            }
            if (exp.type === 'split') {
                for (const person in exp.splitDetails) {
                    const splitAmountCNY = (exp.finalCNY / exp.amount) * exp.splitDetails[person];
                    if (this.people.includes(person)) {
                        balances[person] -= splitAmountCNY;
                    } else {
                        balances[exp.payer] -= splitAmountCNY;
                        if (!externalDebts[person]) externalDebts[person] = {};
                        if (!externalDebts[person][exp.payer]) externalDebts[person][exp.payer] = 0;
                        externalDebts[person][exp.payer] += splitAmountCNY;
                    }
                }
            } else if (!exp.isPrivate) {
                const perPersonAmount = exp.finalCNY / this.people.length;
                this.people.forEach(p => { balances[p] -= perPersonAmount; });
            } else {
                balances[exp.payer] -= exp.finalCNY;
            }
        });

        const statsGrid = document.getElementById('ta-statsGrid');
        statsGrid.innerHTML = '';
        this.people.forEach(p => {
            statsGrid.innerHTML += `<div class="ta-stat-box"><div class="ta-stat-label">${p} 已付</div><div class="ta-stat-value">${Math.round(payerTotals[p])}</div></div>`;
        });

        const publicExpenses = this.expenses.filter(e => !e.isPrivate);
        const publicTotalCost = publicExpenses.reduce((sum, item) => sum + item.finalCNY, 0);
        const publicSharedTotal = this.expenses.filter(e => !e.isPrivate && e.type === 'shared').reduce((sum, item) => sum + item.finalCNY, 0);
        document.getElementById('ta-totalSpent').innerText = publicTotalCost.toFixed(2);
        const perPersonShare = this.people.length > 0 ? publicSharedTotal / this.people.length : 0;
        document.getElementById('ta-perPerson').innerText = perPersonShare.toFixed(2);

        this._calculateInternalSettlement(balances);
        this._calculateExternalSettlement(externalDebts);
    },

    _calculateInternalSettlement(personBalances) {
        const planDiv = document.getElementById('ta-settlementPlan');
        this.settlementLog = [];
        if (this.people.length < 2) {
            planDiv.innerHTML = '<div class="ta-text-center ta-text-muted ta-small" style="padding:8px 0;">暂无数据</div>';
            return;
        }

        let finalBalances = {};
        let unassignedPeople = [...this.people];
        this.families.forEach(family => {
            finalBalances[family.rep] = 0;
            family.members.forEach(member => {
                if (personBalances[member] !== undefined) finalBalances[family.rep] += personBalances[member];
                unassignedPeople = unassignedPeople.filter(p => p !== member);
            });
        });
        unassignedPeople.forEach(person => { finalBalances[person] = personBalances[person]; });

        let balancesArr = [];
        for (let name in finalBalances) {
            if (Math.abs(finalBalances[name]) > 0.01) balancesArr.push({ name, diff: finalBalances[name] });
        }

        let debtors = balancesArr.filter(p => p.diff < 0).sort((a, b) => a.diff - b.diff);
        let creditors = balancesArr.filter(p => p.diff > 0).sort((a, b) => b.diff - a.diff);

        let html = '';
        if (debtors.length === 0 && creditors.length === 0) {
            html = '<div class="ta-text-center ta-text-muted ta-small">完美平衡</div>';
            this.settlementLog.push('队友间无需转账');
        } else {
            let i = 0, j = 0;
            while (i < debtors.length && j < creditors.length) {
                let debtor = debtors[i], creditor = creditors[j];
                let amount = Math.min(Math.abs(debtor.diff), creditor.diff);
                html += `<div class="ta-settlement-item">${debtor.name} <svg class="ta-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> ${creditor.name} <span class="ta-settlement-amount">¥${amount.toFixed(2)}</span></div>`;
                this.settlementLog.push(`${debtor.name} 给 ${creditor.name} 转 ¥${amount.toFixed(2)}`);
                debtor.diff += amount;
                creditor.diff -= amount;
                if (Math.abs(debtor.diff) < 0.01) i++;
                if (creditor.diff < 0.01) j++;
            }
        }
        planDiv.innerHTML = html;
    },

    _calculateExternalSettlement(debts) {
        const div = document.getElementById('ta-externalSettlementPlan');
        this.externalSettlementLog = [];
        let html = '';
        let hasDebt = false;
        for (const outsider in debts) {
            for (const creditor in debts[outsider]) {
                const amount = debts[outsider][creditor];
                if (amount > 0.01) {
                    hasDebt = true;
                    html += `<div class="ta-settlement-item ta-external">${outsider} (外部) <svg class="ta-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> ${creditor} <span class="ta-settlement-amount">¥${amount.toFixed(2)}</span></div>`;
                    this.externalSettlementLog.push(`${outsider} (外部) 需支付给 ${creditor} ¥${amount.toFixed(2)}`);
                }
            }
        }
        if (!hasDebt) div.innerHTML = '<div class="ta-text-center ta-text-muted ta-small" style="padding:8px 0;">无外部账目</div>';
        else div.innerHTML = html;
    },

    // --- CRUD ---
    deleteExpense(id) {
        if (confirm('确认删除这条记录吗？')) {
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.save();
            this.renderTable();
            this.updateSummary();
        }
    },

    clearData() {
        if (confirm('确定清空所有账单记录吗？(人员和家庭设置会保留)')) {
            this.expenses = [];
            this.save();
            this.renderTable();
            this.updateSummary();
        }
    },

    // --- Export ---
    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            Utils.showToast(I18n.t('t.travel_sheetjs_needed', '导出功能需要网络加载 SheetJS 库'));
            return;
        }
        if (this.expenses.length === 0) { Utils.showToast(I18n.t('t.travel_no_data_export', '暂无数据可导出')); return; }
        const dataToExport = this.expenses.map(e => {
            let splitDetailStr = '';
            let typeStr = '';
            if (e.isPrivate) typeStr = '个人/代购';
            else if (e.type === 'shared') typeStr = '公共-均摊';
            else typeStr = '公共-指定分摊';
            if (e.type === 'split') {
                for (const p in e.splitDetails) splitDetailStr += `${p}: ${e.splitDetails[p]}; `;
            }
            return {
                '日期': e.date, '项目': e.item, '付款人': e.payer, '费用类型': typeStr,
                '币种': e.currency, '原币总额': e.amount, '汇率': e.currency === 'CNY' ? '-' : `${e.rate}`,
                '折合人民币': e.finalCNY, '分摊详情(原币)': splitDetailStr
            };
        });
        const publicTotal = this.expenses.filter(e => !e.isPrivate).reduce((sum, item) => sum + item.finalCNY, 0);
        dataToExport.push({});
        dataToExport.push({ '项目': '【公共费用统计】' });
        dataToExport.push({ '项目': '总支出', '折合人民币': publicTotal.toFixed(2) });
        dataToExport.push({});
        dataToExport.push({ '项目': '【内部结账方案】' });
        if (this.settlementLog.length > 0) this.settlementLog.forEach(log => dataToExport.push({ '项目': log }));
        dataToExport.push({});
        dataToExport.push({ '项目': '【外部收款清单】' });
        if (this.externalSettlementLog.length > 0) this.externalSettlementLog.forEach(log => dataToExport.push({ '项目': log }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'StarryTrip账单');
        XLSX.writeFile(wb, `旅行账单_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
};
