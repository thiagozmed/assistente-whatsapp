function toneInstruction(tone) {
  if (tone === 'afetuoso') return 'Use um tom próximo, caloroso e afetuoso, como alguém de confiança que se importa.';
  if (tone === 'formal') return 'Use um tom respeitoso e formal, mantendo distância cordial.';
  return null;
}

// Base prompt sempre primeiro, personalização sempre depois como sufixo — deixa
// pronto pra um cache_control breakpoint futuro (Fase 7) sem precisar redesenhar.
function buildPersonalizedSystemPrompt(basePrompt, profile) {
  if (!profile) return basePrompt;

  const parts = [basePrompt];
  const persona = [];

  if (profile.assistant_name) {
    persona.push(`Seu nome, escolhido pelo usuário, é "${profile.assistant_name}". Responda por esse nome se perguntarem.`);
  }
  const tone = toneInstruction(profile.tone);
  if (tone) persona.push(tone);
  if (persona.length) parts.push(`\n---\nPersonalização deste usuário:\n${persona.join('\n')}`);

  if (profile.last_interaction_summary) {
    parts.push(
      `\n---\nContexto da última interação relevante (${profile.last_interaction_type}, ${profile.last_interaction_at}):\n${profile.last_interaction_summary}\nUse só se for relevante para a mensagem atual.`,
    );
  }

  return parts.join('\n');
}

module.exports = { buildPersonalizedSystemPrompt };
