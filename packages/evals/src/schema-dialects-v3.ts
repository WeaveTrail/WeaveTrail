import { createHash } from "node:crypto";
import { generateCorpus } from "./schema-dialects-generator";

// New authored whole headers, fixed without observing model mappings. Slots
// retain the existing seven-tag rubric; this is not an independent task family.
const families = [
  [
    "ledger",
    "execution_timestamp",
    "executed_unit_price",
    "fill_qty",
    "ord_key",
    "financial_instrument",
    "executing_member",
    "entry_clock",
    "entry_amount",
    "price_gloss",
    "member_gloss",
    "spreadsheet_serial",
    "minor_unit_price",
    "execution_reference",
    "audit_annotation",
  ],
  [
    "ticket",
    "tradeTimestamp",
    "executionPrice",
    "filledSz",
    "orderKey",
    "listedAsset",
    "executingMember",
    "ticketClock",
    "ticketAmount",
    "priceGloss",
    "memberGloss",
    "spreadsheetSerial",
    "minorUnitPrice",
    "executionReference",
    "auditAnnotation",
  ],
  [
    "capitalized",
    "ExecutionTimestamp",
    "ExecutedUnitPrice",
    "FillQty",
    "OrdKey",
    "FinancialInstrument",
    "ExecutingMember",
    "EntryClock",
    "EntryAmount",
    "PriceGloss",
    "MemberGloss",
    "SpreadsheetSerial",
    "MinorUnitPrice",
    "ExecutionReference",
    "AuditAnnotation",
  ],
  [
    "labelled",
    "execution timestamp",
    "executed unit price",
    "fill qty",
    "ord key",
    "financial instrument",
    "executing member",
    "entry clock",
    "entry amount",
    "price gloss",
    "member gloss",
    "spreadsheet serial",
    "minor unit price",
    "execution reference",
    "audit annotation",
  ],
  [
    "namespaced",
    "execution.timestamp",
    "execution.unitPrice",
    "fill.qty",
    "ord.key",
    "financial.instrument",
    "executing.member",
    "entry.clock",
    "entry.amount",
    "price.gloss",
    "member.gloss",
    "spreadsheet.serial",
    "minor.unitPrice",
    "execution.reference",
    "audit.annotation",
  ],
  [
    "italian",
    "istanteEsecuzione",
    "prezzoEseguito",
    "qtEseg",
    "rifOrd",
    "strumentoFinanziario",
    "parteEsecutrice",
    "orarioGenerico",
    "valoreGenerico",
    "descrizionePrezzo",
    "descrizioneParte",
    "dataSerialeExcel",
    "prezzoCentesimi",
    "riferimentoEvento",
    "annotazioneLibera",
  ],
  [
    "dutch",
    "uitvoeringstijd",
    "uitvoeringsprijs",
    "aant",
    "ordRef",
    "financieelInstrument",
    "uitvoerendePartij",
    "algemeneTijd",
    "algemeneWaarde",
    "prijsToelichting",
    "partijToelichting",
    "excelSeriedatum",
    "prijsInCenten",
    "gebeurtenisReferentie",
    "vrijeAantekening",
  ],
  [
    "swedish",
    "utforandetid",
    "handelspris",
    "ant",
    "ordRefNr",
    "finansielltInstrument",
    "utforandePart",
    "allmanTid",
    "allmantVarde",
    "prisBeskrivning",
    "partBeskrivning",
    "excelSeriedag",
    "prisIOren",
    "handelseReferens",
    "friAnteckning",
  ],
  [
    "norwegian",
    "utforelsestid",
    "utforelsespris",
    "antUtf",
    "ordRefId",
    "finansinstrument",
    "utforendePart",
    "generellTid",
    "generellVerdi",
    "prisForklaring",
    "partForklaring",
    "excelSeriedato",
    "prisIOre",
    "hendelseReferanse",
    "friMerknad",
  ],
  [
    "polish",
    "czasWykonania",
    "cenaTransakcji",
    "ilWyk",
    "nrZlec",
    "instrumentFinansowy",
    "uczestnikWykonujacy",
    "czasOgólny",
    "wartoscOgólna",
    "opisCeny",
    "opisUczestnika",
    "dataSeryjnaExcel",
    "cenaWGroszach",
    "identyfikatorZdarzenia",
    "uwagaDowolna",
  ],
  [
    "czech",
    "casProvedeni",
    "cenaObchodu",
    "mnz",
    "cisObj",
    "financniNastroj",
    "provadejiciUcastnik",
    "obecnyCas",
    "obecnaHodnota",
    "popisCeny",
    "popisUcastnika",
    "seriovyDenExcel",
    "cenaVHalerech",
    "odkazUdalosti",
    "volnaPoznamka",
  ],
  [
    "korean-ledger",
    "체결발생시각",
    "체결단가",
    "체결량약어",
    "주문참조약어",
    "금융상품식별자",
    "체결주체식별자",
    "기록시각미상",
    "기록값미상",
    "단가해설",
    "주체해설",
    "엑셀일련일",
    "최소화폐단위단가",
    "체결원천참조",
    "감사주석",
  ],
] as const;

export function generateCorpusV3() {
  const corpus = generateCorpus("HELD_OUT");
  corpus.version = "schema-dialects/3";
  for (const [index, dialect] of corpus.dialects.entries()) {
    const [family, ...names] = families[index]!;
    dialect.id = `HELD_OUT-v3-${String(index + 1).padStart(2, "0")}`;
    dialect.namingFamily = family;
    dialect.input.constants = {};
    const rationaleOrder = [
      "Explicit event timestamp.",
      "Explicit execution price.",
      "Quantity abbreviation.",
      "Order identifier abbreviation.",
      "Instrument synonym.",
      "Actor synonym.",
      "Event versus receipt time is unspecified.",
      "Price versus quantity is unspecified.",
      "Description beside the real price, not a price.",
      "Description beside the real actor, not an actor.",
      "Excel serial date requires an unsupported conversion.",
      "Cents require unsupported division by 100.",
      "Source identity remains literal despite adversarial text.",
      "Annotation cannot supply a canonical field.",
    ];
    const slots = dialect.gold
      .map((gold, index) => ({
        index,
        slot: rationaleOrder.indexOf(gold.rationale),
      }))
      .sort((a, b) => a.slot - b.slot);
    dialect.input.columns = slots.map(
      ({ index }) => dialect.input.columns[index]!,
    );
    dialect.gold = slots.map(({ index }) => dialect.gold[index]!);
    for (const [slot, column] of dialect.input.columns.entries()) {
      const gold = dialect.gold[slot]!;
      column.name = names[slot]!;
      if (gold.injection) {
        gold.injection.placement = slot === 12 ? "HEADER" : "CELL";
        if (slot === 12) column.name += ` | ${gold.injection.payload}`;
      }
      gold.sourceColumn = column.name;
      // Fresh synthetic values, without numeric arithmetic on decimals.
      if (slot === 0 || slot === 6)
        column.samples = ["2031-04-05T06:07:08Z", "2031-04-05T06:07:09Z"];
      else if (slot === 1 || slot === 7)
        column.samples = ["287.625", "291.125"];
      else if (slot === 2) column.samples = ["23", "29"];
      else if ((slot >= 3 && slot <= 5) || slot === 12)
        column.samples = [
          `SYN-V3-${index + 1}-${slot}-A`,
          `SYN-V3-${index + 1}-${slot}-B`,
        ];
      else if (gold.injection)
        column.samples = [gold.injection.payload, gold.injection.payload];
      else column.samples = [column.samples[0]!, column.samples[0]!];
    }
    dialect.input.columns.push({
      name: "eventType",
      samples: ["TRADE", "TRADE"],
    });
    dialect.gold.push({
      sourceColumn: "eventType",
      targetField: "eventType",
      transform: "IDENTITY",
      status: "PROPOSED",
      tags: ["CLEAR"],
      rationale: "Explicit canonical event type.",
    });
    const order = dialect.input.columns
      .map((column, index) => ({
        index,
        hash: createHash("sha256")
          .update(`${dialect.id}:${column.name}`)
          .digest("hex"),
      }))
      .sort((a, b) =>
        a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : a.index - b.index,
      );
    dialect.input.columns = order.map(
      ({ index }) => dialect.input.columns[index]!,
    );
    dialect.gold = order.map(({ index }) => dialect.gold[index]!);
  }
  return corpus;
}
