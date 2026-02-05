import { supabase } from "../lib/supabaseClient.js";

export function randomCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function toErrorMessage(context, error) {
  const message = error?.message ? `: ${error.message}` : "";
  return `${context}${message}`;
}

export async function createGroup(name) {
  const join_code = randomCode();
  const payload = { name, total_hizb: 60, join_code };
  const { data, error } = await supabase
    .from("groups")
    .insert(payload)
    .select("id, name, join_code, total_hizb")
    .single();

  if (error) {
    throw new Error(toErrorMessage("Impossible de créer le groupe", error));
  }

  return data;
}

export async function getGroupByCode(code) {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("join_code", code)
    .single();

  if (error) {
    throw new Error(
      toErrorMessage("Impossible de récupérer le groupe par code", error)
    );
  }

  return data;
}

export async function listParticipations(groupId) {
  const { data, error } = await supabase
    .from("participations")
    .select("*")
    .eq("group_id", groupId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      toErrorMessage("Impossible de lister les participations", error)
    );
  }

  return data ?? [];
}

export function computeNextSlot(participations, size, total = 60) {
  const normalizedSize = Number(size);
  if (![1, 2].includes(normalizedSize)) {
    throw new Error("Part invalide (choisir 1 ou 2).");
  }
  const maxTotal = Number(total);
  if (!Number.isFinite(maxTotal) || maxTotal <= 0) {
    throw new Error("Total de hizb invalide.");
  }

  const taken = new Set();
  for (const p of participations || []) {
    if (p?.cancelled_at) continue;
    const start = Number(p.start_hizb);
    const end = Number(p.end_hizb);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      for (let i = start; i <= end; i += 1) {
        taken.add(i);
      }
    }
  }

  if (normalizedSize === 1) {
    for (let i = 1; i <= maxTotal; i += 1) {
      if (!taken.has(i)) {
        return { start: i, end: i };
      }
    }
  } else {
    for (let i = 1; i <= maxTotal - 1; i += 1) {
      if (!taken.has(i) && !taken.has(i + 1)) {
        return { start: i, end: i + 1 };
      }
    }
  }

  throw new Error("Plus de hizb disponibles pour cette taille");
}

export async function joinGroup(
  groupId,
  displayName,
  nameInitial,
  hizbTaken,
  startHizb,
  endHizb
) {
  const normalizedSize = Number(hizbTaken);
  if (![1, 2].includes(normalizedSize)) {
    throw new Error("Part invalide (choisir 1 ou 2).");
  }
  const start = Number(startHizb);
  const end = Number(endHizb);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("Plage de hizb invalide.");
  }
  const payload = {
    group_id: groupId,
    display_name: displayName,
    name_initial: nameInitial,
    hizb_taken: normalizedSize,
    start_hizb: start,
    end_hizb: end,
  };

  const { data, error } = await supabase
    .from("participations")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(toErrorMessage("Impossible de rejoindre le groupe", error));
  }

  return data;
}

export async function findByName(groupId, displayName, nameInitial) {
  const { data, error } = await supabase
    .from("participations")
    .select(
      "id, display_name, name_initial, start_hizb, end_hizb, completed"
    )
    .eq("group_id", groupId)
    .ilike("display_name", displayName)
    .ilike("name_initial", nameInitial)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      toErrorMessage("Impossible de verifier le nom", error)
    );
  }

  return data ?? [];
}

export async function markCompleted(participationId, editToken) {
  const { data, error } = await supabase
    .from("participations")
    .update({ completed: true })
    .eq("id", participationId)
    .eq("edit_token", editToken)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      toErrorMessage("Impossible de marquer la participation terminée", error)
    );
  }

  return data;
}

export async function deleteParticipation(participationId, editToken) {
  const { data, error } = await supabase
    .from("participations")
    .delete()
    .eq("id", participationId)
    .eq("edit_token", editToken)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      toErrorMessage("Impossible de supprimer la participation", error)
    );
  }

  return data;
}

export async function cancelParticipation(participationId, editToken) {
  const { data, error } = await supabase
    .from("participations")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", participationId)
    .eq("edit_token", editToken)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      toErrorMessage("Impossible d'annuler la participation", error)
    );
  }

  return data;
}

export async function finishGroup(groupId) {
  const { data, error } = await supabase
    .from("groups")
    .update({
      finished_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", groupId)
    .is("finished_at", null)
    .select("*")
    .single();

  if (error) {
    throw new Error(toErrorMessage("Impossible de terminer le groupe", error));
  }

  return data;
}
