import { describe, expect, it } from 'vitest'
import { calcularComisionPartner, calcularComisionesPeriodo } from './calculoComisiones'

const configDefault = {
  base_escalon_1: 26,
  base_escalon_2: 28,
  base_escalon_3: 30,
  umbral_escalon_1: 5,
  umbral_escalon_2: 12,
  bonus_dd: 4,
  bonus_fe: 1,
  sva_tarifa_baja: 10,
  sva_tarifa_alta: 14,
  sva_umbral_pct: 10,
  potencia_umbral_kva: 20.7,
  base_alta_potencia: 60,
}

function venta({ dd = false, fe = false, sva = false, electricidad = true, gas = false, potencia = null } = {}) {
  return {
    debito_directo: dd,
    factura_electronica: fe,
    sva,
    electricidad,
    gas,
    potencia_kva: potencia,
  }
}

describe('calcularComisionPartner — electricidad (ejemplo de la sección 5, adaptado)', () => {
  it('8 contratos, 6 DD, 5 FE, 2 SVA => la tarifa SVA (según %) se paga solo sobre los 2 contratos con SVA', () => {
    const ventasPartner = [
      venta({ dd: true, fe: true, sva: true }),
      venta({ dd: true, fe: true, sva: true }),
      venta({ dd: true, fe: true }),
      venta({ dd: true, fe: true }),
      venta({ dd: true, fe: true }),
      venta({ dd: true }),
      venta(),
      venta(),
    ]

    const resultado = calcularComisionPartner(ventasPartner, configDefault)

    expect(resultado.n_contratos).toBe(8)
    expect(resultado.n_contratos_luz).toBe(8)
    expect(resultado.escalon_luz).toBe(2)
    expect(resultado.base_luz).toBe(28)
    expect(resultado.n_dd_luz).toBe(6)
    expect(resultado.n_fe_luz).toBe(5)
    expect(resultado.n_sva_luz).toBe(2)
    expect(resultado.pct_sva_luz).toBeCloseTo(25)
    expect(resultado.tarifa_sva_luz).toBe(14)
    // base 28*8=224 + DD 4*6=24 + FE 1*5=5 + SVA 14*2(solo los SVA)=28 => 281
    expect(resultado.total_comision_luz).toBe(281)
    expect(resultado.n_contratos_gas).toBe(0)
    expect(resultado.total_comision_gas).toBe(0)
    expect(resultado.total_comision).toBe(281)
  })

  it('escalón 1: hasta 5 contratos', () => {
    const ventasPartner = Array.from({ length: 5 }, () => venta())
    const resultado = calcularComisionPartner(ventasPartner, configDefault)
    expect(resultado.escalon_luz).toBe(1)
    expect(resultado.base_luz).toBe(26)
  })

  it('escalón 3: más de 12 contratos', () => {
    const ventasPartner = Array.from({ length: 13 }, () => venta())
    const resultado = calcularComisionPartner(ventasPartner, configDefault)
    expect(resultado.escalon_luz).toBe(3)
    expect(resultado.base_luz).toBe(30)
  })

  it('pct_sva exactamente en el umbral (10%) aplica la tarifa alta', () => {
    const ventasPartner = [venta({ sva: true }), ...Array.from({ length: 9 }, () => venta())]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)
    expect(resultado.pct_sva_luz).toBeCloseTo(10)
    expect(resultado.tarifa_sva_luz).toBe(14)
  })
})

describe('calcularComisionPartner — potencia contratada > 20,7 kVA', () => {
  it('un contrato de alta potencia cobra 60€ de base sin importar el escalón', () => {
    // Escalón 1 (2 contratos, base normal 26€): uno de ellos con alta potencia.
    const ventasPartner = [venta({ potencia: 22 }), venta({ potencia: 10 })]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)

    expect(resultado.escalon_luz).toBe(1)
    expect(resultado.base_luz).toBe(26) // base "de referencia" del escalón, informativa
    expect(resultado.n_alta_potencia).toBe(1)
    // 1 contrato a 60€ (alta potencia) + 1 contrato a 26€ (normal) = 86€ de base total
    expect(resultado.total_base_luz).toBe(86)
  })

  it('el override de 60€ aplica también en escalón 3 (no se limita a escalón 1)', () => {
    // 13 contratos → escalón 3 (30€ normal); uno de ellos con alta potencia.
    const ventasPartner = [
      venta({ potencia: 25 }),
      ...Array.from({ length: 12 }, () => venta()),
    ]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)

    expect(resultado.escalon_luz).toBe(3)
    expect(resultado.n_alta_potencia).toBe(1)
    // 1 contrato a 60€ + 12 contratos a 30€ = 420€
    expect(resultado.total_base_luz).toBe(420)
  })

  it('exactamente 20,7 kVA NO activa el override (el umbral es estrictamente mayor que)', () => {
    const ventasPartner = [venta({ potencia: 20.7 })]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)
    expect(resultado.n_alta_potencia).toBe(0)
    expect(resultado.total_base_luz).toBe(26)
  })

  it('el umbral y la base de alta potencia son configurables, no fijos en código', () => {
    const configPersonalizada = { ...configDefault, potencia_umbral_kva: 15, base_alta_potencia: 99 }
    const ventasPartner = [venta({ potencia: 18 })]
    const resultado = calcularComisionPartner(ventasPartner, configPersonalizada)
    expect(resultado.n_alta_potencia).toBe(1)
    expect(resultado.total_base_luz).toBe(99)
  })
})

describe('calcularComisionPartner — contratos duales (electricidad + gas)', () => {
  it('un contrato dual genera comisión de electricidad Y de gas por separado', () => {
    const ventasPartner = [venta({ electricidad: true, gas: true, dd: true, sva: true })]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)

    // Electricidad: 1 contrato, escalón 1 (26€) + 4€ DD + 14€ SVA (100% SVA) = 44€
    expect(resultado.n_contratos_luz).toBe(1)
    expect(resultado.total_comision_luz).toBe(26 + 4 + 14)

    // Gas: misma lógica, mismos parámetros, sobre el mismo contrato.
    expect(resultado.n_contratos_gas).toBe(1)
    expect(resultado.total_comision_gas).toBe(26 + 4 + 14)

    // El total es la suma de ambas.
    expect(resultado.total_comision).toBe(resultado.total_comision_luz + resultado.total_comision_gas)
    // Pero solo cuenta como 1 venta física.
    expect(resultado.n_contratos).toBe(1)
  })

  it('electricidad y gas se escalan de forma independiente según su propio volumen', () => {
    // 6 contratos solo electricidad (escalón 2, 28€) + 2 contratos solo gas (escalón 1, 26€)
    const ventasPartner = [
      ...Array.from({ length: 6 }, () => venta({ electricidad: true, gas: false })),
      ...Array.from({ length: 2 }, () => venta({ electricidad: false, gas: true })),
    ]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)

    expect(resultado.n_contratos).toBe(8)
    expect(resultado.n_contratos_luz).toBe(6)
    expect(resultado.escalon_luz).toBe(2)
    // 0% SVA (<10%) → tarifa baja, pero 0 contratos con SVA => bonus SVA = 0: 6*28 = 168
    expect(resultado.total_comision_luz).toBe(6 * 28)

    expect(resultado.n_contratos_gas).toBe(2)
    expect(resultado.escalon_gas).toBe(1)
    // 0% SVA (<10%) → tarifa baja, pero 0 contratos con SVA => bonus SVA = 0: 2*26 = 52
    expect(resultado.total_comision_gas).toBe(2 * 26)
  })

  it('el override de potencia solo aplica a electricidad, nunca a gas', () => {
    const ventasPartner = [venta({ electricidad: true, gas: true, potencia: 30 })]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)

    expect(resultado.total_base_luz).toBe(60) // override
    expect(resultado.n_alta_potencia).toBe(1)
    expect(resultado.total_base_gas).toBe(26) // gas no tiene override de potencia
  })
})

describe('calcularComisionesPeriodo', () => {
  it('agrupa las ventas por partner', () => {
    const ventas = [
      { id_partner: 'P1', ...venta({ dd: true }) },
      { id_partner: 'P1', ...venta() },
      { id_partner: 'P2', ...venta({ sva: true, gas: true }) },
    ]
    const resultado = calcularComisionesPeriodo(ventas, configDefault)
    expect(resultado).toHaveLength(2)
    const p1 = resultado.find((r) => r.id_partner === 'P1')
    const p2 = resultado.find((r) => r.id_partner === 'P2')
    expect(p1.n_contratos).toBe(2)
    expect(p2.n_contratos).toBe(1)
    expect(p2.n_contratos_gas).toBe(1)
  })
})
