// ============================================================
//  MÖRK BORG COMPANION — supabase.js
//  Integração com Supabase: Auth + Database + Storage
//  CONFIGURE: substitua as constantes abaixo com seus dados
// ============================================================

'use strict';

// ── CONFIGURAÇÃO ─────────────────────────────────────────────
// 1. Vá em https://supabase.com → seu projeto → Settings → API
// 2. Copie "Project URL" e "anon public key"
const SUPABASE_URL  = 'https://fjwydnmdubiseqncyzgb.supabase.co';   // ex: https://xyzxyz.supabase.co
const SUPABASE_ANON = 'sb_publishable_eeOm49d4BW5aaObjSzsF5w_osTGu1lc';       // chave pública (anon)

// ── SDK DO SUPABASE (via CDN, já incluído no index.html) ─────
const { createClient } = window.supabase;
export const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── AUTH ──────────────────────────────────────────────────────

/** Retorna o usuário logado atualmente (ou null) */
export async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

/** Cadastro com e-mail + senha */
export async function signUp(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Login com e-mail + senha */
export async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Logout */
export async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

/** Escuta mudanças de sessão (login/logout) */
export function onAuthChange(callback) {
  return db.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

// ── PERSONAGENS ───────────────────────────────────────────────

/**
 * Salva (insert ou update) um personagem do usuário logado.
 * O campo `retrato` é o URL público da imagem no Storage (ou null).
 */
export async function saveCharacter(charData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Remove o base64 do retrato — usa URL do storage
  const { retrato, ...rest } = charData;

  const payload = {
    user_id:    user.id,
    char_id:    rest.id || Date.now().toString(),
    nome:       rest.nome        || '',
    classe:     rest.classe      || '',
    dados:      rest,             // JSONB com tudo
    retrato_url: retrato && retrato.startsWith('http') ? retrato : null,
    modificado: new Date().toISOString()
  };

  const { data, error } = await db
    .from('personagens')
    .upsert(payload, { onConflict: 'user_id,char_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Lista todos os personagens do usuário logado
 * Retorna array resumido: { char_id, nome, classe, retrato_url, modificado }
 */
export async function listCharacters() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await db
    .from('personagens')
    .select('char_id, nome, classe, retrato_url, modificado')
    .eq('user_id', user.id)
    .order('modificado', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Carrega um personagem completo pelo char_id
 */
export async function loadCharacter(charId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await db
    .from('personagens')
    .select('dados, retrato_url')
    .eq('user_id', user.id)
    .eq('char_id', charId)
    .single();

  if (error) throw error;

  // Mescla o retrato_url de volta nos dados
  return { ...data.dados, retrato: data.retrato_url || data.dados.retrato || '' };
}

/**
 * Apaga um personagem pelo char_id
 */
export async function deleteCharacter(charId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await db
    .from('personagens')
    .delete()
    .eq('user_id', user.id)
    .eq('char_id', charId);

  if (error) throw error;
}

// ── STORAGE (Imagens de retrato) ──────────────────────────────

/**
 * Faz upload de uma imagem de retrato para o Supabase Storage.
 * Retorna a URL pública da imagem.
 * @param {File} file - Arquivo de imagem selecionado pelo usuário
 * @param {string} charId - ID do personagem (usado no nome do arquivo)
 */
export async function uploadPortrait(file, charId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const ext      = file.name.split('.').pop();
  const filePath = `${user.id}/${charId}.${ext}`;

  const { error: uploadError } = await db.storage
    .from('retratos')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = db.storage
    .from('retratos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
