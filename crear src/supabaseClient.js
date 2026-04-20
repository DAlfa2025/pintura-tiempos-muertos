// ============================================================
// CLIENTE DE SUPABASE - ACCESO PÚBLICO (SIN LOGIN)
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// ------------------- CATÁLOGOS -------------------
export async function cargarEstaciones() {
  const { data, error } = await supabase.from("estaciones").select("id, nombre").eq("activo", true).order("nombre");
  if (error) throw error;
  return data;
}

export async function cargarMotivos() {
  const { data, error } = await supabase.from("motivos").select("id, nombre").eq("activo", true).order("nombre");
  if (error) throw error;
  return data;
}

export async function cargarDepartamentos() {
  const { data, error } = await supabase.from("departamentos").select("id, nombre, color").eq("activo", true).order("nombre");
  if (error) throw error;
  return data;
}

export async function cargarTurnos() {
  const { data, error } = await supabase.from("turnos").select("id, nombre, minutos_productivos").eq("activo", true).order("id");
  if (error) throw error;
  return data;
}

// ------------------- REGISTROS -------------------
export async function guardarRegistro(registro) {
  const payload = {
    fecha: registro.fecha,
    turno: registro.turno,
    estacion: registro.estacion,
    motivo: registro.motivo,
    tiempo_muerto_min: registro.tiempoMuerto,
    responsable: registro.responsable,
    comentarios: registro.comentarios || null,
    registrado_por: registro.registradoPor || "anónimo"
  };
  const { data, error } = await supabase.from("registros_tiempo_muerto").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function cargarRegistros({ desde = null, hasta = null, responsable = null, estacion = null, limite = 5000, offset = 0 } = {}) {
  let q = supabase.from("registros_tiempo_muerto").select("*", { count: "exact" })
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .range(offset, offset + limite - 1);
  if (desde) q = q.gte("fecha", desde);
  if (hasta) q = q.lte("fecha", hasta);
  if (responsable) q = q.eq("responsable", responsable);
  if (estacion) q = q.eq("estacion", estacion);
  const { data, error, count } = await q;
  if (error) throw error;
  return { registros: data, total: count };
}

export async function eliminarRegistro(id) {
  const { error } = await supabase.from("registros_tiempo_muerto").delete().eq("id", id);
  if (error) throw error;
}

// ------------------- TIEMPO REAL -------------------
export function suscribirseARegistros(callback) {
  const canal = supabase
    .channel("registros-canal")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "registros_tiempo_muerto" },
      (payload) => callback(payload))
    .subscribe();
  return () => supabase.removeChannel(canal);
}
