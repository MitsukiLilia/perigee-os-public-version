// Perigee OS 帮助中心
// 渲染分组+折叠卡片，从设置页 / onboarding 完成后进入

const Help = {
    _rendered: false,
    _expandedId: null, // 当前展开项的 id

    // v2.179.0：内容拆到 assets/help-content.json 懒加载，首次打开先 fetch 再渲染
    async open(jumpToId) {
        if (typeof Navigation !== 'undefined') {
            Navigation.goTo('help-center');
        }
        if (!this._rendered) {
            const scroll = document.getElementById('helpCenterScroll');
            if (!HelpContent.sections && scroll) {
                scroll.innerHTML = `<div class="help-intro"><div class="help-intro-sub">加载中…</div></div>`;
            }
            try {
                await HelpContent.load();
            } catch (e) {
                if (scroll) {
                    scroll.innerHTML = `<div class="help-intro"><div class="help-intro-sub">帮助内容加载失败、请检查网络后重试。</div></div>`;
                    scroll.onclick = () => { scroll.onclick = null; this.open(jumpToId); };
                }
                return;
            }
            this.render();
            this._rendered = true;
        }
        if (jumpToId) {
            this._expandedId = jumpToId;
            this._refreshExpansion();
            const el = document.querySelector(`.help-item[data-id="${jumpToId}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    render() {
        const scroll = document.getElementById('helpCenterScroll');
        if (!scroll) return;

        const groups = HelpContent.getGroups();
        let html = `
            <div class="help-intro">
                <div class="help-intro-title">使用指南</div>
                <div class="help-intro-sub">点开任意一节展开，找朋友帮你玩耍前先看看这里。</div>
            </div>
        `;

        groups.forEach(group => {
            const children = HelpContent.getChildren(group.id);
            html += `
                <div class="help-group">
                    <div class="help-group-title">${group.title}</div>
                    <div class="help-group-items">
                        ${children.map(item => `
                            <div class="help-item" data-id="${item.id}">
                                <div class="help-item-header" onclick="Help.toggle('${item.id}')">
                                    <div class="help-item-title">${item.title}</div>
                                    <svg class="help-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                                <div class="help-item-body">${item.body}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        scroll.innerHTML = html;
    },

    toggle(id) {
        if (this._expandedId === id) {
            this._expandedId = null;
        } else {
            this._expandedId = id;
        }
        this._refreshExpansion();
    },

    _refreshExpansion() {
        document.querySelectorAll('.help-item').forEach(el => {
            if (el.dataset.id === this._expandedId) {
                el.classList.add('expanded');
            } else {
                el.classList.remove('expanded');
            }
        });
    }
};
