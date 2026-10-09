$baseUrl = "https://raconsinop.com.br"
$outDir = "docs/screenshots"

$routes = @(
    @{ name = "01_home_publica"; path = ""; cat = "site-publico" },
    @{ name = "02_simulador_consorcio"; path = "simulador"; cat = "site-publico" },
    @{ name = "03_grupos_e_cotas"; path = "grupos"; cat = "site-publico" },
    @{ name = "04_oportunidades_imobiliarias"; path = "oportunidades-imobiliarias"; cat = "site-publico" },
    @{ name = "05_cartas_contempladas"; path = "cartas-contempladas"; cat = "site-publico" },
    @{ name = "06_calculadoras_financeiras"; path = "calculadoras"; cat = "site-publico" },
    @{ name = "07_eventos"; path = "eventos"; cat = "site-publico" },
    @{ name = "08_dicas_racon_blog"; path = "dicas-do-tche"; cat = "site-publico" },
    @{ name = "09_seja_parceiro_landing"; path = "parceiros"; cat = "portais-parceiros" },
    @{ name = "10_cadastro_parceiro"; path = "parceiros/cadastro"; cat = "portais-parceiros" },
    @{ name = "11_login_erp_admin"; path = "login"; cat = "autenticacao" },
    @{ name = "12_app_indicador_login"; path = "app-indicador/login"; cat = "app-indicador" },
    @{ name = "13_recuperacao_senha"; path = "esqueci-senha"; cat = "autenticacao" }
)

Write-Output "Iniciando captura de telas em segundo plano (Headless) do site raconsinop.com.br..."

foreach ($r in $routes) {
    $targetCatDir = "$outDir/$($r.cat)"
    if (!(Test-Path $targetCatDir)) {
        New-Item -ItemType Directory -Path $targetCatDir -Force | Out-Null
    }

    $url = if ($r.path -eq "") { $baseUrl } else { "$baseUrl/$($r.path)" }
    $outFile = "$targetCatDir/$($r.name).png"

    Write-Output "Capturando [$($r.cat)] $($r.name) ($url)..."
    npx playwright screenshot --channel=chrome $url $outFile
}

Write-Output "Todas as capturas foram concluidas."
