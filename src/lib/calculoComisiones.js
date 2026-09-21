// Modelo de comisiones: ver CLAUDE.md y sección 5 del documento de especificación.
// Escalado retroactivo por nº de contratos + bonus DD/FE + bonus de nivel SVA.
//
// Un contrato puede ser de electricidad, de gas, o de ambos (dual). Para un
// contrato dual se calcula y paga comisión de electricidad Y de gas, cada una
// con EXACTAMENTE la misma lógica (escalado + bonus DD/FE + bonus SVA) y los
// mismos parámetros configurados — el gas no tiene parámetros propios.
//
// Electricidad tiene un matiz adicional: si la potencia contratada de un
// contrato supera config.potencia_umbral_kva, la base de ESE contrato pasa a
// ser config.base_alta_potencia, sin importar el escalón de volumen del mes
// (ambos son parámetros editables en la pantalla de configuración).

export function calcularEscalon(nContratos, config) {
  if (nContratos <= config.umbral_escalon_1) {
    return { escalon: 1, base: Number(config.base_escalon_1) }
  }
  if (nContratos <= config.umbral_escalon_2) {
    return { escalon: 2, base: Number(config.base_escalon_2) }
  }
  return { escalon: 3, base: Number(config.base_escalon_3) }
}

// Calcula el desglose de comisión de un combustible (electricidad o gas) a
// partir de los contratos de ESE combustible. `esElectricidad` activa el
// override de potencia >20,7 kVA (solo aplica a electricidad).
function calcularComisionCombustible(contratos, config, esElectricidad) {
  const nContratos = contratos.length
  const { escalon, base } = calcularEscalon(nContratos, config)

  const umbralPotencia = Number(config.potencia_umbral_kva)
  const baseAltaPotencia = Number(config.base_alta_potencia)

  let nAltaPotencia = 0
  const totalBase = contratos.reduce((acc, v) => {
    const altaPotencia =
      esElectricidad && v.potencia_kva != null && Number(v.potencia_kva) > umbralPotencia
    if (altaPotencia) {
      nAltaPotencia += 1
      return acc + baseAltaPotencia
    }
    return acc + base
  }, 0)

  const nDd = contratos.filter((v) => v.debito_directo).length
  const nFe = contratos.filter((v) => v.factura_electronica).length
  const nSva = contratos.filter((v) => v.sva).length

  const pctSva = nContratos === 0 ? 0 : (nSva / nContratos) * 100
  const tarifaSva =
    pctSva >= Number(config.sva_umbral_pct)
      ? Number(config.sva_tarifa_alta)
      : Number(config.sva_tarifa_baja)

  const totalBonusDd = nDd * Number(config.bonus_dd)
  const totalBonusFe = nFe * Number(config.bonus_fe)
  const totalBonusSva = tarifaSva * nContratos
  const totalComision = totalBase + totalBonusDd + totalBonusFe + totalBonusSva

  return {
    nContratos,
    escalon: nContratos === 0 ? null : escalon,
    base,
    nDd,
    nFe,
    nSva,
    pctSva,
    tarifaSva: nContratos === 0 ? null : tarifaSva,
    totalBase,
    totalBonusDd,
    totalBonusFe,
    totalBonusSva,
    totalComision,
    nAltaPotencia,
  }
}

// ventasPartner: array de ventas de un partner en un periodo (ya filtradas).
// config: fila de configuracion_comisiones (o su snapshot).
export function calcularComisionPartner(ventasPartner, config) {
  const contratosLuz = ventasPartner.filter((v) => v.electricidad)
  const contratosGas = ventasPartner.filter((v) => v.gas)

  const luz = calcularComisionCombustible(contratosLuz, config, true)
  const gas = calcularComisionCombustible(contratosGas, config, false)

  return {
    // Nº de ventas físicas del partner ese mes (un contrato dual cuenta 1 vez).
    n_contratos: ventasPartner.length,

    n_contratos_luz: luz.nContratos,
    escalon_luz: luz.escalon,
    base_luz: luz.base,
    n_dd_luz: luz.nDd,
    n_fe_luz: luz.nFe,
    n_sva_luz: luz.nSva,
    pct_sva_luz: luz.pctSva,
    tarifa_sva_luz: luz.tarifaSva,
    total_base_luz: luz.totalBase,
    total_bonus_dd_luz: luz.totalBonusDd,
    total_bonus_fe_luz: luz.totalBonusFe,
    total_bonus_sva_luz: luz.totalBonusSva,
    total_comision_luz: luz.totalComision,
    n_alta_potencia: luz.nAltaPotencia,

    n_contratos_gas: gas.nContratos,
    escalon_gas: gas.escalon,
    base_gas: gas.base,
    n_dd_gas: gas.nDd,
    n_fe_gas: gas.nFe,
    n_sva_gas: gas.nSva,
    pct_sva_gas: gas.pctSva,
    tarifa_sva_gas: gas.tarifaSva,
    total_base_gas: gas.totalBase,
    total_bonus_dd_gas: gas.totalBonusDd,
    total_bonus_fe_gas: gas.totalBonusFe,
    total_bonus_sva_gas: gas.totalBonusSva,
    total_comision_gas: gas.totalComision,

    // Gran total: comisión de electricidad + comisión de gas.
    total_comision: luz.totalComision + gas.totalComision,
  }
}

// ventas: array de ventas de TODOS los partners en un periodo.
// Devuelve un array de { id_partner, ...desglose } agrupado por id_partner.
export function calcularComisionesPeriodo(ventas, config) {
  const porPartner = new Map()
  for (const venta of ventas) {
    const lista = porPartner.get(venta.id_partner) ?? []
    lista.push(venta)
    porPartner.set(venta.id_partner, lista)
  }

  return Array.from(porPartner.entries()).map(([idPartner, ventasPartner]) => ({
    id_partner: idPartner,
    ...calcularComisionPartner(ventasPartner, config),
  }))
}
