/**
 * 静的アセットは wrangler [assets] が優先。
 * 未マッチのリクエストは not_found_handling (SPA) で index.html へ。
 * 将来 /api などを足す場合はここで分岐する。
 */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
