import { fetchPublicCartas } from "@/app/admin/cartas-contempladas/actions";
import { fetchPublicGruposAggregates } from "@/app/admin/grupos/actions";
import { fetchPublicImobiliariasParceiras } from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import {
  DEFAULT_CONTATO,
  DEFAULT_HOME_CARTAS,
  DEFAULT_HOME_OPORTUNIDADES,
  DEFAULT_SITE,
  type ContatoConfig,
  type HomeCartasConfig,
  type HomeOportunidadesConfig,
  type SiteConfig,
} from "@/lib/config/defaults";
import type { CartaContemplada } from "@/lib/cartas/types";
import type { ImovelPublic } from "@/lib/imoveis/types";
import type { PublicGrupoAggregate } from "@/lib/types";
import { getConfigJsonPublic, getSimuladorConfigsPublic } from "@/server/config";
import { safeFetch } from "./safe-fetch";
import {
  fetchPublicCasosSucesso,
  fetchPublicDicas,
  fetchPublicParceiros,
} from "@/lib/conteudo/fetch-public";
import type { CasoSucesso, DicaTche, ParceiroInstitucional } from "@/lib/conteudo/types";

export type HomeGrupoDestaque = {
  grupo: PublicGrupoAggregate["grupo"];
  cota: PublicGrupoAggregate["cotas"][0];
};

export type HomePageData = {
  site: SiteConfig;
  contato: ContatoConfig;
  homeCartas: HomeCartasConfig;
  homeOportunidades: HomeOportunidadesConfig;
  simuladorDefaults: {
    prazoImovel: number;
    prazoAutomovel: number;
    valorImovel: number;
    valorAutomovel: number;
  };
  gruposDestaque: HomeGrupoDestaque[];
  cartasDestaque: CartaContemplada[];
  imoveisDestaque: ImovelPublic[];
  imobiliariasParceiras: Awaited<ReturnType<typeof fetchPublicImobiliariasParceiras>>;
  casosDestaque: CasoSucesso[];
  dicasDestaque: DicaTche[];
  parceirosDestaque: ParceiroInstitucional[];
};

const GRUPOS_HOME_LIMIT = 6;

export async function loadHomePageData(): Promise<HomePageData> {
  const [site, contato, homeCartas, homeOportunidades, simConfigs] = await Promise.all([
    getConfigJsonPublic("site", DEFAULT_SITE),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
    getConfigJsonPublic("home_cartas", DEFAULT_HOME_CARTAS),
    getConfigJsonPublic("home_oportunidades_imobiliarias", DEFAULT_HOME_OPORTUNIDADES),
    getSimuladorConfigsPublic(),
  ]);

  const aggregates = await safeFetch(() => fetchPublicGruposAggregates(), [] as PublicGrupoAggregate[]);
  const gruposDestaque: HomeGrupoDestaque[] = aggregates.slice(0, GRUPOS_HOME_LIMIT).map((a) => ({
    grupo: a.grupo,
    cota: a.cotas[0]!,
  }));

  let cartasDestaque: CartaContemplada[] = [];
  if (homeCartas.exibirNaHome !== false) {
    const limit = Math.max(1, homeCartas.quantidade || 3);
    const cartas = await safeFetch(
      () =>
        fetchPublicCartas({
          apenasDestaque: homeCartas.mostrarApenasDestaque,
        }),
      [] as CartaContemplada[],
    );
    cartasDestaque = cartas.slice(0, limit);
    if (!cartasDestaque.length && homeCartas.mostrarApenasDestaque) {
      const all = await safeFetch(() => fetchPublicCartas({}), [] as CartaContemplada[]);
      cartasDestaque = all.slice(0, limit);
    }
  }

  let imoveisDestaque: ImovelPublic[] = [];
  if (homeOportunidades.exibir_home !== false) {
    const limit = Math.max(1, homeOportunidades.quantidade || 6);
    let imoveis = await safeFetch(
      () => fetchPublicImoveis({ destaque: true }),
      [] as ImovelPublic[],
    );
    if (!imoveis.length) {
      imoveis = await safeFetch(() => fetchPublicImoveis({}), [] as ImovelPublic[]);
    }
    imoveisDestaque = imoveis.slice(0, limit);
  }

  const imobiliariasParceiras = await safeFetch(
    () => fetchPublicImobiliariasParceiras(),
    [] as Awaited<ReturnType<typeof fetchPublicImobiliariasParceiras>>,
  );

  const casosDestaque = await safeFetch(
    () => fetchPublicCasosSucesso({ destaque: true, limit: 3 }),
    [] as CasoSucesso[],
  );
  let casosHome = casosDestaque;
  if (!casosHome.length) {
    casosHome = await safeFetch(() => fetchPublicCasosSucesso({ limit: 3 }), [] as CasoSucesso[]);
  }

  const dicasDestaque = await safeFetch(
    () => fetchPublicDicas({ destaque: true, limit: 3 }),
    [] as DicaTche[],
  );
  let dicasHome = dicasDestaque;
  if (!dicasHome.length) {
    dicasHome = await safeFetch(() => fetchPublicDicas({ limit: 3 }), [] as DicaTche[]);
  }

  const parceirosDestaque = await safeFetch(
    () => fetchPublicParceiros({ destaque: true, limit: 12 }),
    [] as ParceiroInstitucional[],
  );

  return {
    site,
    contato,
    homeCartas,
    homeOportunidades,
    simuladorDefaults: {
      prazoImovel: simConfigs.imovel.prazoPadrao,
      prazoAutomovel: simConfigs.automovel.prazoPadrao,
      valorImovel: simConfigs.imovel.valorPadraoInicial,
      valorAutomovel: simConfigs.automovel.valorPadraoInicial,
    },
    gruposDestaque,
    cartasDestaque,
    imoveisDestaque,
    imobiliariasParceiras,
    casosDestaque: casosHome,
    dicasDestaque: dicasHome,
    parceirosDestaque,
  };
}
