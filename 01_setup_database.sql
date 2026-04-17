-- =====================================================================
-- SISTEMA DE TIEMPOS MUERTOS - LÍNEA DE PINTURA LÍQUIDA (SIN LOGIN)
-- Script de inicialización para Supabase / PostgreSQL
-- =====================================================================
-- Ejecuta este script completo en el SQL Editor de Supabase
-- Menú: SQL Editor → New query → Pega todo → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLA DE CATÁLOGO: ESTACIONES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO estaciones (nombre) VALUES
    ('Carga / Hanging'), ('Cuarto base'), ('Área de inspección'), ('Lijado'),
    ('Sopleteo de Pretratamiento'), ('Sopleteo'), ('Pretratamiento'), ('ASU fresh'),
    ('Cabina base'), ('Cabina Clear'), ('Cabina de primer'), ('Cuarto base de robot'),
    ('Cuarto de bombas'), ('Mixroom'), ('Keller'), ('Panel central de carga'),
    ('Inspección hornos'), ('Fresh AHU')
ON CONFLICT (nombre) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. TABLA DE CATÁLOGO: MOTIVOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS motivos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO motivos (nombre) VALUES
    ('Carga de material Virgen'), ('Alto voltaje robot base'), ('Alto voltaje robot clear'),
    ('Aplicación manual Base'), ('Aplicación manual Clear'), ('Aplicación manual Primer'),
    ('Boiler alarmado'), ('Cambio de color Robot'), ('Carga de material hidrografia'),
    ('Colisión de robot'), ('Contaminación de material'), ('Desface de conveyor'),
    ('Falla de chiller'), ('Falla de fresh'), ('Falla de horno Curado'),
    ('Falla de horno Secado'), ('Falla de internet'), ('Falla de jeringa'),
    ('Falla de line on'), ('Falla de presión de bomba Base'), ('Falla de presión de bomba Clear'),
    ('Falla de presión de bomba Solvente'), ('Falla de rahu'), ('Falla o Daño de pistola'),
    ('Falta de personal cabinas'), ('Falta de personal carga'), ('Falta de personal descarga'),
    ('Falta de material PPC'), ('Faltante de primer'), ('Inspección de piezas'),
    ('Jig mal puesto'), ('Keller shut off'), ('Mal retrabajo'),
    ('No painting information'), ('Personal en entrenamiento'), ('Pieza mal colgada'),
    ('Piezas con agua'), ('Relleno de pintura'), ('Rotación de campana'),
    ('Sopleteo pretratamiento')
ON CONFLICT (nombre) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. TABLA DE CATÁLOGO: DEPARTAMENTOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(10),
    activo BOOLEAN DEFAULT true
);

INSERT INTO departamentos (nombre, color) VALUES
    ('EHS', '#dc2626'), ('FACILITIES', '#ea580c'), ('MANTENIMIENTO', '#ca8a04'),
    ('INGENIERÍA', '#16a34a'), ('PPC', '#0891b2'), ('PRODUCCIÓN', '#2563eb'),
    ('QA', '#7c3aed'), ('SQA', '#c026d3')
ON CONFLICT (nombre) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. TABLA DE CATÁLOGO: TURNOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turnos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(60) UNIQUE NOT NULL,
    minutos_productivos INTEGER NOT NULL,
    activo BOOLEAN DEFAULT true
);

INSERT INTO turnos (nombre, minutos_productivos) VALUES
    ('Lunes a Jueves', 535), ('Viernes', 490),
    ('Lunes a Jueves OT', 705), ('Viernes OT', 660),
    ('Sábado', 430), ('Martes a Jueves Recuperación', 595),
    ('Jueves Recuperación Final', 565), ('Noche', 490),
    ('Noche OT', 670)
ON CONFLICT (nombre) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. TABLA PRINCIPAL: REGISTROS DE TIEMPO MUERTO
-- ---------------------------------------------------------------------
-- Si la tabla ya existe con auth.users, la dejamos sin relación obligatoria
CREATE TABLE IF NOT EXISTS registros_tiempo_muerto (
    id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    turno VARCHAR(60) NOT NULL,
    estacion VARCHAR(100) NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    tiempo_muerto_min NUMERIC(10,2) NOT NULL CHECK (tiempo_muerto_min > 0),
    responsable VARCHAR(50) NOT NULL,
    comentarios TEXT,
    registrado_por VARCHAR(100),
    usuario_id UUID,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros_tiempo_muerto(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_registros_responsable ON registros_tiempo_muerto(responsable);
CREATE INDEX IF NOT EXISTS idx_registros_estacion ON registros_tiempo_muerto(estacion);
CREATE INDEX IF NOT EXISTS idx_registros_turno ON registros_tiempo_muerto(turno);

CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_registro ON registros_tiempo_muerto;
CREATE TRIGGER trg_actualizar_registro
    BEFORE UPDATE ON registros_tiempo_muerto
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ---------------------------------------------------------------------
-- 6. VISTAS
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vista_resumen_turno AS
SELECT
    r.fecha, r.turno,
    t.minutos_productivos AS total_turno_min,
    SUM(r.tiempo_muerto_min) AS tiempo_muerto_total,
    GREATEST(0, t.minutos_productivos - SUM(r.tiempo_muerto_min)) AS tiempo_productivo,
    ROUND((SUM(r.tiempo_muerto_min) / t.minutos_productivos * 100)::numeric, 2) AS pct_muerto,
    ROUND(((t.minutos_productivos - SUM(r.tiempo_muerto_min)) / t.minutos_productivos * 100)::numeric, 2) AS eficiencia,
    COUNT(*) AS num_eventos
FROM registros_tiempo_muerto r
LEFT JOIN turnos t ON t.nombre = r.turno
GROUP BY r.fecha, r.turno, t.minutos_productivos
ORDER BY r.fecha DESC, r.turno;

CREATE OR REPLACE VIEW vista_top_motivos AS
SELECT motivo, COUNT(*) AS eventos,
    SUM(tiempo_muerto_min) AS minutos_totales,
    ROUND(AVG(tiempo_muerto_min)::numeric, 2) AS promedio_min
FROM registros_tiempo_muerto GROUP BY motivo
ORDER BY minutos_totales DESC;

-- =====================================================================
-- 7. SEGURIDAD: ACCESO PÚBLICO (SIN LOGIN)
-- =====================================================================
-- Estas políticas permiten acceso a CUALQUIER persona que tenga el link
-- y la anon key. Si quieres más control, considera agregar login más adelante.

-- Borrar políticas previas si existen (de la versión con login)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver todos los registros" ON registros_tiempo_muerto;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar" ON registros_tiempo_muerto;
DROP POLICY IF EXISTS "Usuarios pueden editar sus registros" ON registros_tiempo_muerto;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus registros" ON registros_tiempo_muerto;
DROP POLICY IF EXISTS "Lectura pública de catálogos" ON estaciones;
DROP POLICY IF EXISTS "Lectura pública de catálogos" ON motivos;
DROP POLICY IF EXISTS "Lectura pública de catálogos" ON departamentos;
DROP POLICY IF EXISTS "Lectura pública de catálogos" ON turnos;

-- Activar RLS
ALTER TABLE registros_tiempo_muerto ENABLE ROW LEVEL SECURITY;
ALTER TABLE estaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

-- Políticas públicas: cualquiera con la anon key puede leer y escribir
CREATE POLICY "Acceso público lectura registros" ON registros_tiempo_muerto FOR SELECT TO anon USING (true);
CREATE POLICY "Acceso público insertar registros" ON registros_tiempo_muerto FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Acceso público actualizar registros" ON registros_tiempo_muerto FOR UPDATE TO anon USING (true);
CREATE POLICY "Acceso público eliminar registros" ON registros_tiempo_muerto FOR DELETE TO anon USING (true);

CREATE POLICY "Acceso público catálogos" ON estaciones FOR SELECT TO anon USING (true);
CREATE POLICY "Acceso público catálogos" ON motivos FOR SELECT TO anon USING (true);
CREATE POLICY "Acceso público catálogos" ON departamentos FOR SELECT TO anon USING (true);
CREATE POLICY "Acceso público catálogos" ON turnos FOR SELECT TO anon USING (true);

-- =====================================================================
-- FIN DEL SCRIPT
-- =====================================================================
-- Verifica con:
-- SELECT * FROM estaciones;
-- =====================================================================
