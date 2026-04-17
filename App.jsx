import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area, ComposedChart } from "recharts";
import { Plus, Save, Trash2, Filter, Download, BarChart3, Clock, AlertTriangle, Activity, X, Factory, Target } from "lucide-react";
import {
  cargarEstaciones, cargarMotivos, cargarDepartamentos, cargarTurnos,
  guardarRegistro as dbGuardarRegistro,
  cargarRegistros, eliminarRegistro as dbEliminarRegistro,
  suscribirseARegistros
} from "./supabaseClient";

const COLORES_RESP = {
  "EHS": "#dc2626", "FACILITIES": "#ea580c", "MANTENIMIENTO": "#ca8a04",
  "INGENIERÍA": "#16a34a", "PPC": "#0891b2", "PRODUCCIÓN": "#2563eb",
  "QA": "#7c3aed", "SQA": "#c026d3"
};

const PALETA = ["#ff6b35", "#f7931e", "#fcbf49", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#c026d3", "#dc2626", "#ea580c", "#ca8a04", "#059669", "#0284c7", "#4338ca", "#9333ea", "#be185d", "#b91c1c", "#d97706"];

export default function App() {
  const [estaciones, setEstaciones] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [vista, setVista] = useState("registro");

  // Nombre del registrador (se guarda en localStorage para no reescribirlo)
  const [nombreUsuario, setNombreUsuario] = useState(() => {
    try { return localStorage.getItem("nombreUsuario") || ""; } catch { return ""; }
  });

  const [estacion, setEstacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [motivoOtro, setMotivoOtro] = useState("");
  const [tiempoMuerto, setTiempoMuerto] = useState("");
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [turno, setTurno] = useState("");
  const [comentarios, setComentarios] = useState("");

  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const [filtroEstacion, setFiltroEstacion] = useState("");

  const notificar = (texto, tipo = "ok") => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 3500);
  };

  // Cargar catálogos y registros al iniciar
  useEffect(() => {
    const inicializar = async () => {
      setCargando(true);
      try {
        const [est, mot, dep, tur] = await Promise.all([
          cargarEstaciones(), cargarMotivos(),
          cargarDepartamentos(), cargarTurnos()
        ]);
        setEstaciones(est);
        setMotivos(mot);
        setDepartamentos(dep);
        setTurnos(tur);
        if (tur.length > 0) setTurno(tur[0].nombre);
      } catch (e) {
        notificar("Error al cargar datos: " + e.message, "error");
      }
      await recargarRegistros();
      setCargando(false);
    };
    inicializar();
  }, []);

  // Suscripción en tiempo real
  useEffect(() => {
    const desuscribir = suscribirseARegistros(() => recargarRegistros());
    return desuscribir;
    // eslint-disable-next-line
  }, [filtroDesde, filtroHasta, filtroResp, filtroEstacion]);

  const recargarRegistros = async () => {
    try {
      const { registros: regs, total } = await cargarRegistros({
        desde: filtroDesde || null,
        hasta: filtroHasta || null,
        responsable: filtroResp || null,
        estacion: filtroEstacion || null,
        limite: 5000
      });
      setRegistros(regs);
      setTotalRegistros(total);
    } catch (e) {
      notificar("Error al cargar registros: " + e.message, "error");
    }
  };

  useEffect(() => {
    recargarRegistros();
    // eslint-disable-next-line
  }, [filtroDesde, filtroHasta, filtroResp, filtroEstacion]);

  const actualizarNombreUsuario = (nuevo) => {
    setNombreUsuario(nuevo);
    try { localStorage.setItem("nombreUsuario", nuevo); } catch {}
  };

  const guardarRegistro = async () => {
    if (!estacion || !motivo || !tiempoMuerto || !responsable || !fecha || !turno) {
      notificar("Completa todos los campos obligatorios", "error");
      return;
    }
    if (motivo === "Otro" && !motivoOtro.trim()) {
      notificar("Especifica el motivo en 'Otro'", "error");
      return;
    }
    const mins = parseFloat(tiempoMuerto);
    if (isNaN(mins) || mins <= 0) {
      notificar("Tiempo muerto debe ser mayor a 0", "error");
      return;
    }

    setGuardando(true);
    try {
      await dbGuardarRegistro({
        fecha, turno, estacion,
        motivo: motivo === "Otro" ? `Otro: ${motivoOtro.trim()}` : motivo,
        tiempoMuerto: mins,
        responsable,
        comentarios: comentarios.trim() || null,
        registradoPor: nombreUsuario.trim() || "anónimo"
      });
      setEstacion(""); setMotivo(""); setMotivoOtro("");
      setTiempoMuerto(""); setResponsable(""); setComentarios("");
      await recargarRegistros();
      notificar("Registro guardado en la base de datos");
    } catch (e) {
      notificar("Error al guardar: " + e.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarRegistro = async (id) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await dbEliminarRegistro(id);
      await recargarRegistros();
      notificar("Registro eliminado");
    } catch (e) {
      notificar("Error: " + e.message, "error");
    }
  };

  const exportarCSV = () => {
    if (registros.length === 0) {
      notificar("No hay registros para exportar", "error");
      return;
    }
    const header = ["Fecha", "Turno", "Estación", "Motivo", "Tiempo Muerto (min)", "Responsable", "Comentarios", "Registrado por"];
    const filas = registros.map(r => [r.fecha, r.turno, r.estacion, r.motivo, r.tiempo_muerto_min, r.responsable, r.comentarios || "", r.registrado_por || ""]);
    const csv = [header, ...filas].map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiempos_muertos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------- Cálculos para gráficas -------
  const datosPorMotivo = useMemo(() => {
    const ag = {};
    registros.forEach(r => { ag[r.motivo] = (ag[r.motivo] || 0) + parseFloat(r.tiempo_muerto_min); });
    return Object.entries(ag).map(([m, min]) => ({ motivo: m.length > 25 ? m.slice(0, 25) + "…" : m, minutos: min }))
      .sort((a, b) => b.minutos - a.minutos).slice(0, 15);
  }, [registros]);

  const datosPorResponsable = useMemo(() => {
    const ag = {};
    registros.forEach(r => { ag[r.responsable] = (ag[r.responsable] || 0) + parseFloat(r.tiempo_muerto_min); });
    return Object.entries(ag).map(([resp, min]) => ({ responsable: resp, minutos: min, color: COLORES_RESP[resp] }));
  }, [registros]);

  const datosRespDetalle = useMemo(() => {
    const ag = {};
    registros.forEach(r => {
      if (!ag[r.responsable]) ag[r.responsable] = { responsable: r.responsable, minutos: 0, eventos: 0 };
      ag[r.responsable].minutos += parseFloat(r.tiempo_muerto_min);
      ag[r.responsable].eventos += 1;
    });
    return Object.values(ag).sort((a, b) => b.minutos - a.minutos);
  }, [registros]);

  const datosPorEstacion = useMemo(() => {
    const ag = {};
    registros.forEach(r => { ag[r.estacion] = (ag[r.estacion] || 0) + parseFloat(r.tiempo_muerto_min); });
    return Object.entries(ag).map(([e, m]) => ({ estacion: e, minutos: m })).sort((a, b) => b.minutos - a.minutos);
  }, [registros]);

  const datosTendencia = useMemo(() => {
    const ag = {};
    registros.forEach(r => { ag[r.fecha] = (ag[r.fecha] || 0) + parseFloat(r.tiempo_muerto_min); });
    return Object.entries(ag).map(([f, m]) => ({ fecha: f, minutos: m })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [registros]);

  const datosAcumulado = useMemo(() => {
    let acum = 0;
    return datosTendencia.map(d => { acum += d.minutos; return { fecha: d.fecha, acumulado: acum }; });
  }, [datosTendencia]);

  const comparacionPorTurno = useMemo(() => {
    const ag = {};
    registros.forEach(r => {
      const k = `${r.fecha}|${r.turno}`;
      if (!ag[k]) {
        const t = turnos.find(x => x.nombre === r.turno);
        ag[k] = { fecha: r.fecha, turno: r.turno, totalMin: t ? t.minutos_productivos : 0, muerto: 0 };
      }
      ag[k].muerto += parseFloat(r.tiempo_muerto_min);
    });
    return Object.values(ag).map(x => ({
      etiqueta: `${x.fecha} · ${x.turno}`,
      productivo: Math.max(0, x.totalMin - x.muerto),
      muerto: Math.min(x.muerto, x.totalMin),
      pctMuerto: x.totalMin > 0 ? parseFloat(((x.muerto / x.totalMin) * 100).toFixed(1)) : 0,
      eficiencia: x.totalMin > 0 ? parseFloat((((x.totalMin - x.muerto) / x.totalMin) * 100).toFixed(1)) : 0
    }));
  }, [registros, turnos]);

  const datosPareto = useMemo(() => {
    const total = datosPorMotivo.reduce((s, d) => s + d.minutos, 0);
    let acum = 0;
    return datosPorMotivo.map(d => {
      acum += d.minutos;
      return { motivo: d.motivo, minutos: d.minutos, acumPct: total > 0 ? parseFloat(((acum / total) * 100).toFixed(1)) : 0 };
    });
  }, [datosPorMotivo]);

  const datosRadarEstacion = useMemo(() => datosPorEstacion.slice(0, 8).map(d => ({
    estacion: d.estacion.length > 18 ? d.estacion.slice(0, 18) + "…" : d.estacion,
    minutos: d.minutos
  })), [datosPorEstacion]);

  const matrizEstResp = useMemo(() => {
    const ag = {};
    registros.forEach(r => {
      const k = `${r.estacion}|${r.responsable}`;
      ag[k] = (ag[k] || 0) + parseFloat(r.tiempo_muerto_min);
    });
    const estUsadas = [...new Set(registros.map(r => r.estacion))];
    const depNombres = departamentos.map(d => d.nombre);
    return estUsadas.map(est => {
      const row = { estacion: est.length > 22 ? est.slice(0, 22) + "…" : est };
      depNombres.forEach(resp => { row[resp] = ag[`${est}|${resp}`] || 0; });
      return row;
    });
  }, [registros, departamentos]);

  const totalMinutos = registros.reduce((s, r) => s + parseFloat(r.tiempo_muerto_min), 0);
  const totalEventos = registros.length;
  const promedioEvento = totalEventos > 0 ? (totalMinutos / totalEventos).toFixed(1) : 0;
  const eficienciaProm = comparacionPorTurno.length > 0
    ? (comparacionPorTurno.reduce((s, x) => s + x.eficiencia, 0) / comparacionPorTurno.length).toFixed(1) : 0;

  const limpiarFiltros = () => {
    setFiltroDesde(""); setFiltroHasta(""); setFiltroResp(""); setFiltroEstacion("");
  };

  const maxHeat = Math.max(1, ...matrizEstResp.flatMap(r => departamentos.map(d => r[d.nombre] || 0)));
  const heatColor = (v) => {
    if (v === 0) return "#0a0e14";
    const i = v / maxHeat;
    const r = Math.round(255 * i + 26 * (1 - i));
    const g = Math.round(107 * i + 41 * (1 - i));
    const b = Math.round(53 * i + 54 * (1 - i));
    return `rgb(${r},${g},${b})`;
  };

  const nombresDeps = departamentos.map(d => d.nombre);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e14", color: "#e8eaed", fontFamily: "'Inter','Segoe UI',sans-serif", padding: "16px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ borderBottom: "2px solid #1e3a5f", paddingBottom: 16, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "linear-gradient(135deg, #ff6b35, #f7931e)", padding: 10, borderRadius: 8, display: "flex" }}>
              <Factory size={26} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Control de Tiempos Muertos</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#8b96a5" }}>Línea de Pintura Líquida</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" value={nombreUsuario} onChange={e => actualizarNombreUsuario(e.target.value)}
              placeholder="Tu nombre (opcional)"
              style={{ padding: "7px 11px", background: "#0a0e14", border: "1px solid #1e2936", borderRadius: 5, color: "#e8eaed", fontSize: 12, width: 160, outline: "none" }} />
            <button onClick={() => setVista("registro")} style={btnTab(vista === "registro")}><Plus size={16} /> Registro</button>
            <button onClick={() => setVista("dashboard")} style={btnTab(vista === "dashboard")}><BarChart3 size={16} /> Dashboard</button>
            <button onClick={() => setVista("historial")} style={btnTab(vista === "historial")}><Clock size={16} /> Historial</button>
          </div>
        </div>

        {mensaje && (
          <div style={{
            padding: "10px 14px", marginBottom: 16, borderRadius: 6,
            background: mensaje.tipo === "error" ? "#3b1919" : "#0f2e1d",
            border: `1px solid ${mensaje.tipo === "error" ? "#dc2626" : "#16a34a"}`,
            color: mensaje.tipo === "error" ? "#fca5a5" : "#86efac",
            fontSize: 14, display: "flex", alignItems: "center", gap: 8
          }}>
            {mensaje.tipo === "error" ? <AlertTriangle size={16} /> : <Activity size={16} />}
            {mensaje.texto}
          </div>
        )}

        {cargando && <div style={{ textAlign: "center", padding: 40, color: "#8b96a5" }}>Cargando datos...</div>}

        {!cargando && vista === "registro" && (
          <div style={tarjeta}>
            <h2 style={tituloSeccion}>Nuevo Registro de Tiempo Muerto</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
              <div>
                <label style={labelEst}>Estación / Área *</label>
                <select value={estacion} onChange={e => setEstacion(e.target.value)} style={inputEst}>
                  <option value="">-- Selecciona una estación --</option>
                  {estaciones.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={labelEst}>Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputEst} />
              </div>
              <div>
                <label style={labelEst}>Turno *</label>
                <select value={turno} onChange={e => setTurno(e.target.value)} style={inputEst}>
                  <option value="">-- Selecciona --</option>
                  {turnos.map(t => <option key={t.id} value={t.nombre}>{t.nombre} ({t.minutos_productivos} min)</option>)}
                </select>
              </div>
              <div>
                <label style={labelEst}>Tiempo Muerto (minutos) *</label>
                <input type="number" min="0" step="0.5" value={tiempoMuerto} onChange={e => setTiempoMuerto(e.target.value)} placeholder="Ej. 15" style={inputEst} />
              </div>
              <div>
                <label style={labelEst}>Responsable (Departamento) *</label>
                <select value={responsable} onChange={e => setResponsable(e.target.value)} style={inputEst}>
                  <option value="">-- Selecciona --</option>
                  {departamentos.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelEst}>Motivo de Tiempo Muerto *</label>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} style={inputEst}>
                  <option value="">-- Selecciona un motivo --</option>
                  {motivos.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                  <option value="Otro">Otro (especificar)</option>
                </select>
              </div>
              {motivo === "Otro" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelEst}>Especifica el motivo *</label>
                  <input type="text" value={motivoOtro} onChange={e => setMotivoOtro(e.target.value)} placeholder="Describe el motivo..." style={inputEst} />
                </div>
              )}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelEst}>Comentarios (opcional)</label>
                <textarea value={comentarios} onChange={e => setComentarios(e.target.value)} rows={2} placeholder="Detalles adicionales..." style={{ ...inputEst, resize: "vertical", fontFamily: "inherit" }} />
              </div>
            </div>
            <button onClick={guardarRegistro} disabled={guardando} style={{
              marginTop: 20, padding: "12px 24px",
              background: guardando ? "#555" : "linear-gradient(135deg, #ff6b35, #f7931e)",
              color: "#fff", border: "none", borderRadius: 6, fontWeight: 600,
              cursor: guardando ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
              fontSize: 14, letterSpacing: "0.02em"
            }}>
              <Save size={16} /> {guardando ? "Guardando..." : "Guardar Registro"}
            </button>
          </div>
        )}

        {!cargando && vista === "dashboard" && (
          <>
            <div style={tarjeta}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Filter size={16} color="#ff6b35" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Filtros de Análisis</h3>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#8b96a5" }}>{totalRegistros} registros totales</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div>
                  <label style={labelEst}>Desde</label>
                  <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} style={inputEst} />
                </div>
                <div>
                  <label style={labelEst}>Hasta</label>
                  <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} style={inputEst} />
                </div>
                <div>
                  <label style={labelEst}>Responsable</label>
                  <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)} style={inputEst}>
                    <option value="">Todos</option>
                    {departamentos.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelEst}>Estación</label>
                  <select value={filtroEstacion} onChange={e => setFiltroEstacion(e.target.value)} style={inputEst}>
                    <option value="">Todas</option>
                    {estaciones.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={limpiarFiltros} style={btnSec}><X size={14} /> Limpiar filtros</button>
                <button onClick={exportarCSV} style={btnSec}><Download size={14} /> Exportar CSV</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
              <KPI label="Eventos (filtrados)" valor={totalEventos} color="#f7931e" icono={<AlertTriangle size={18} />} />
              <KPI label="Minutos Muertos" valor={totalMinutos.toFixed(1)} color="#dc2626" icono={<Clock size={18} />} />
              <KPI label="Horas Muertas" valor={(totalMinutos / 60).toFixed(1)} color="#c026d3" icono={<Clock size={18} />} />
              <KPI label="Promedio por Evento" valor={`${promedioEvento} min`} color="#0891b2" icono={<Activity size={18} />} />
              <KPI label="Eficiencia Promedio" valor={`${eficienciaProm}%`} color="#16a34a" icono={<Target size={18} />} />
            </div>

            {registros.length === 0 ? (
              <div style={{ ...tarjeta, textAlign: "center", padding: 40, color: "#8b96a5" }}>
                No hay registros que coincidan con los filtros.
              </div>
            ) : (
              <>
                <div style={tarjeta}>
                  <h3 style={tituloSeccion}>① Tiempo Productivo vs Tiempo Muerto por Turno</h3>
                  <ResponsiveContainer width="100%" height={Math.max(280, comparacionPorTurno.length * 35 + 80)}>
                    <BarChart data={comparacionPorTurno} layout="vertical" margin={{ left: 20, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                      <XAxis type="number" stroke="#8b96a5" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="etiqueta" stroke="#8b96a5" tick={{ fontSize: 10 }} width={220} />
                      <Tooltip contentStyle={tooltipSt} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="productivo" stackId="a" fill="#16a34a" name="Tiempo Productivo" />
                      <Bar dataKey="muerto" stackId="a" fill="#dc2626" name="Tiempo Muerto" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={tarjeta}>
                  <h3 style={tituloSeccion}>② % Eficiencia por Turno</h3>
                  <ResponsiveContainer width="100%" height={Math.max(260, comparacionPorTurno.length * 30 + 100)}>
                    <BarChart data={comparacionPorTurno}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                      <XAxis dataKey="etiqueta" stroke="#8b96a5" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" height={140} />
                      <YAxis stroke="#8b96a5" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip contentStyle={tooltipSt} formatter={(v, n) => [`${v}%`, n === "eficiencia" ? "Eficiencia" : "% Muerto"]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="eficiencia" fill="#16a34a" name="Eficiencia" />
                      <Bar dataKey="pctMuerto" fill="#dc2626" name="% Tiempo Muerto" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={tarjeta}>
                  <h3 style={tituloSeccion}>③ Pareto de Motivos (80/20)</h3>
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={datosPareto}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                      <XAxis dataKey="motivo" stroke="#8b96a5" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" height={140} />
                      <YAxis yAxisId="left" stroke="#ff6b35" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#fcbf49" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip contentStyle={tooltipSt} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar yAxisId="left" dataKey="minutos" fill="#ff6b35" name="Minutos" />
                      <Line yAxisId="right" type="monotone" dataKey="acumPct" stroke="#fcbf49" strokeWidth={3} dot={{ fill: "#fcbf49", r: 4 }} name="% Acumulado" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div style={tarjeta}>
                  <h3 style={tituloSeccion}>④ Top 15 Motivos</h3>
                  <ResponsiveContainer width="100%" height={Math.max(300, datosPorMotivo.length * 28 + 60)}>
                    <BarChart data={datosPorMotivo} layout="vertical" margin={{ left: 20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                      <XAxis type="number" stroke="#8b96a5" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="motivo" stroke="#8b96a5" tick={{ fontSize: 10 }} width={190} />
                      <Tooltip contentStyle={tooltipSt} formatter={v => [`${v} min`, "Tiempo"]} />
                      <Bar dataKey="minutos" fill="#ff6b35" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
                  <div style={tarjeta}>
                    <h3 style={tituloSeccion}>⑤ Distribución por Responsable</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={datosPorResponsable} dataKey="minutos" nameKey="responsable" cx="50%" cy="50%" outerRadius={90} label={e => `${e.responsable}: ${e.minutos.toFixed(0)}m`}>
                          {datosPorResponsable.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipSt} formatter={v => [`${v.toFixed(1)} min`, "Tiempo"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={tarjeta}>
                    <h3 style={tituloSeccion}>⑥ Minutos vs Eventos</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={datosRespDetalle}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                        <XAxis dataKey="responsable" stroke="#8b96a5" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" stroke="#ff6b35" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#0891b2" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipSt} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="minutos" fill="#ff6b35" name="Minutos" />
                        <Line yAxisId="right" type="monotone" dataKey="eventos" stroke="#0891b2" strokeWidth={2} name="Eventos" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
                  <div style={tarjeta}>
                    <h3 style={tituloSeccion}>⑦ Por Estación</h3>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={datosPorEstacion} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                        <XAxis type="number" stroke="#8b96a5" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="estacion" stroke="#8b96a5" tick={{ fontSize: 10 }} width={150} />
                        <Tooltip contentStyle={tooltipSt} formatter={v => [`${v.toFixed(1)} min`, "Tiempo"]} />
                        <Bar dataKey="minutos">
                          {datosPorEstacion.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={tarjeta}>
                    <h3 style={tituloSeccion}>⑧ Radar Top 8 Estaciones</h3>
                    <ResponsiveContainer width="100%" height={380}>
                      <RadarChart data={datosRadarEstacion}>
                        <PolarGrid stroke="#1e2936" />
                        <PolarAngleAxis dataKey="estacion" tick={{ fontSize: 10, fill: "#8b96a5" }} />
                        <PolarRadiusAxis tick={{ fontSize: 10, fill: "#8b96a5" }} />
                        <Radar name="Minutos" dataKey="minutos" stroke="#ff6b35" fill="#ff6b35" fillOpacity={0.4} />
                        <Tooltip contentStyle={tooltipSt} formatter={v => [`${v.toFixed(1)} min`, "Tiempo"]} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={tarjeta}>
                  <h3 style={tituloSeccion}>⑨ Tendencia Diaria</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={datosTendencia}>
                      <defs>
                        <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#ff6b35" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                      <XAxis dataKey="fecha" stroke="#8b96a5" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#8b96a5" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipSt} formatter={v => [`${v.toFixed(1)} min`, "Tiempo"]} />
                      <Area type="monotone" dataKey="minutos" stroke="#ff6b35" strokeWidth={2} fill="url(#colorMin)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={tarjeta}>
                  <h3 style={tituloSeccion}>⑩ Acumulado</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={datosAcumulado}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2936" />
                      <XAxis dataKey="fecha" stroke="#8b96a5" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#8b96a5" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipSt} formatter={v => [`${v.toFixed(1)} min`, "Acumulado"]} />
                      <Line type="monotone" dataKey="acumulado" stroke="#fcbf49" strokeWidth={3} dot={{ fill: "#fcbf49", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {matrizEstResp.length > 0 && (
                  <div style={tarjeta}>
                    <h3 style={tituloSeccion}>⑪ Mapa de Calor: Estación × Responsable</h3>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ ...thHeat, textAlign: "left", minWidth: 180 }}>Estación \ Responsable</th>
                            {nombresDeps.map(r => (
                              <th key={r} style={{ ...thHeat, background: COLORES_RESP[r] + "25", color: COLORES_RESP[r] }}>{r}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrizEstResp.map((row, i) => (
                            <tr key={i}>
                              <td style={{ ...tdHeat, textAlign: "left", fontWeight: 600, background: "#0f1823" }}>{row.estacion}</td>
                              {nombresDeps.map(resp => (
                                <td key={resp} style={{
                                  ...tdHeat, background: heatColor(row[resp] || 0),
                                  color: (row[resp] || 0) > maxHeat * 0.5 ? "#fff" : "#8b96a5",
                                  fontWeight: row[resp] > 0 ? 600 : 400
                                }}>
                                  {row[resp] > 0 ? row[resp].toFixed(0) : "–"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!cargando && vista === "historial" && (
          <div style={tarjeta}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Historial ({registros.length} de {totalRegistros} totales)</h3>
              <button onClick={exportarCSV} style={btnSec}><Download size={14} /> Exportar CSV</button>
            </div>
            {registros.length === 0 ? (
              <p style={{ color: "#8b96a5", textAlign: "center", padding: 30 }}>No hay registros.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0f1823" }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Turno</th>
                      <th style={th}>Estación</th>
                      <th style={th}>Motivo</th>
                      <th style={th}>Min</th>
                      <th style={th}>Responsable</th>
                      <th style={th}>Registrado por</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map(r => (
                      <tr key={r.id} style={{ borderBottom: "1px solid #1e2936" }}>
                        <td style={td}>{r.fecha}</td>
                        <td style={{ ...td, fontSize: 11, color: "#8b96a5" }}>{r.turno}</td>
                        <td style={td}>{r.estacion}</td>
                        <td style={td}>{r.motivo}</td>
                        <td style={{ ...td, fontWeight: 600, color: "#ff6b35" }}>{r.tiempo_muerto_min}</td>
                        <td style={td}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: (COLORES_RESP[r.responsable] || "#555") + "30",
                            color: COLORES_RESP[r.responsable] || "#ccc",
                            border: `1px solid ${COLORES_RESP[r.responsable] || "#555"}`
                          }}>{r.responsable}</span>
                        </td>
                        <td style={{ ...td, fontSize: 11, color: "#8b96a5" }}>{r.registrado_por || "–"}</td>
                        <td style={td}>
                          <button onClick={() => eliminarRegistro(r.id)} style={{
                            background: "transparent", border: "1px solid #dc2626", color: "#dc2626",
                            padding: "4px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center"
                          }}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const tarjeta = { background: "#111820", border: "1px solid #1e2936", borderRadius: 8, padding: 18, marginBottom: 16 };
const tituloSeccion = { margin: "0 0 16px 0", fontSize: 15, fontWeight: 600, color: "#e8eaed", paddingBottom: 10, borderBottom: "1px solid #1e2936" };
const labelEst = { display: "block", fontSize: 11, fontWeight: 600, color: "#8b96a5", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" };
const inputEst = { width: "100%", padding: "9px 11px", background: "#0a0e14", border: "1px solid #1e2936", borderRadius: 5, color: "#e8eaed", fontSize: 13, boxSizing: "border-box", outline: "none" };
const btnTab = (a) => ({ padding: "8px 14px", background: a ? "linear-gradient(135deg, #ff6b35, #f7931e)" : "#111820", color: a ? "#fff" : "#8b96a5", border: `1px solid ${a ? "transparent" : "#1e2936"}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 });
const btnSec = { padding: "7px 12px", background: "#0a0e14", border: "1px solid #1e2936", color: "#8b96a5", borderRadius: 5, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 500 };
const tooltipSt = { background: "#0a0e14", border: "1px solid #1e2936", borderRadius: 6, color: "#e8eaed", fontSize: 12 };
const th = { padding: "10px 12px", textAlign: "left", color: "#8b96a5", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #1e2936" };
const td = { padding: "10px 12px", color: "#e8eaed" };
const thHeat = { padding: "8px 10px", textAlign: "center", color: "#8b96a5", fontSize: 10, fontWeight: 600, borderBottom: "1px solid #1e2936", background: "#0f1823" };
const tdHeat = { padding: "8px 10px", textAlign: "center", border: "1px solid #1e2936", minWidth: 60, fontSize: 11 };

function KPI({ label, valor, color, icono }) {
  return (
    <div style={{ background: "#111820", border: "1px solid #1e2936", borderLeft: `3px solid ${color}`, borderRadius: 6, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 11, color: "#8b96a5", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{valor}</div>
      </div>
      <div style={{ color, opacity: 0.6 }}>{icono}</div>
    </div>
  );
}
