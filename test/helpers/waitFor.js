// Espera por polling até a condição ficar true, ou lança timeout.
// Usado pra checar efeitos colaterais de handlers fire-and-forget (o POST
// /webhook responde 200 antes de terminar de processar a mensagem).
async function waitFor(condition, { timeout = 200, interval = 10 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`waitFor: condição não satisfeita em ${timeout}ms`);
}

module.exports = { waitFor };
