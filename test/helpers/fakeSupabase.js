// Imita o formato encadeável/thenable do PostgrestFilterBuilder real do
// supabase-js, só com os métodos que profileStore.js realmente usa.
function fakeQuery(result) {
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    lte: () => builder,
    lt: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

// Variante que captura o payload passado pra insert()/update(), pra testes
// que precisam inspecionar o que de fato seria enviado ao Supabase (ex:
// confirmar que um campo saiu cifrado antes de sair do processo).
function fakeQueryCapture(result, onWrite) {
  const builder = fakeQuery(result);
  const originalInsert = builder.insert;
  const originalUpdate = builder.update;
  builder.insert = (payload) => {
    onWrite(payload);
    return originalInsert();
  };
  builder.update = (payload) => {
    onWrite(payload);
    return originalUpdate();
  };
  return builder;
}

module.exports = { fakeQuery, fakeQueryCapture };
