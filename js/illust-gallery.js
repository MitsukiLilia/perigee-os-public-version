// ===== IllustGallery — IndexedDB Blob 存储模块 =====
// 使用独立的 localforage 实例存储原始 Blob，元数据保存在 AppState
const IllustGallery = {
    _store: null,
    _urlCache: new Map(),  // id → ObjectURL（会话内缓存，避免重复 createObjectURL）

    _getStore() {
        if (!this._store) {
            this._store = localforage.createInstance({
                name: 'perigee-illust-gallery',
                storeName: 'blobs'
            });
        }
        return this._store;
    },

    async save(id, blob) {
        // 同 id 覆盖保存（如立绘重新上传）时失效旧缓存的 ObjectURL，否则已打开过的调用方（如 PV 选择器）
        // 缩略图会一直指向旧图字节，直到下次 getUrl 重建才会指向新图
        if (this._urlCache.has(id)) {
            URL.revokeObjectURL(this._urlCache.get(id));
            this._urlCache.delete(id);
        }
        await this._getStore().setItem(id, blob);
    },

    async getUrl(id) {
        if (this._urlCache.has(id)) return this._urlCache.get(id);
        const blob = await this._getStore().getItem(id);
        if (!blob) return '';
        const url = URL.createObjectURL(blob);
        this._urlCache.set(id, url);
        return url;
    },

    // v2.139.0: 取原始 Blob（gpt-image edits 的 image[] multipart 需要 Blob 本体；CP 参考立绘预览也用）
    async getBlob(id) {
        if (!id) return null;
        return await this._getStore().getItem(id);
    },

    async remove(id) {
        if (this._urlCache.has(id)) {
            URL.revokeObjectURL(this._urlCache.get(id));
            this._urlCache.delete(id);
        }
        await this._getStore().removeItem(id);
    },

    revokeAll() {
        for (const url of this._urlCache.values()) {
            URL.revokeObjectURL(url);
        }
        this._urlCache.clear();
    }
};
