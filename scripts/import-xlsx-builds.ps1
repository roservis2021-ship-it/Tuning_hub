param(
  [string]$InputPath = "C:\Users\rober\OneDrive\Escritorio\tuning_catalogo_comun_v2.xlsx",
  [string]$OutputPath = "firebase\builds-from-xlsx.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ProjectPath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return Join-Path (Get-Location) $PathValue
}

function Normalize-Value([object]$Value) {
  return ([string]$Value).Trim().ToLowerInvariant()
}

function Slugify([string]$Value) {
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder

  foreach ($char in $normalized.ToCharArray()) {
    $unicode = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)

    if ($unicode -eq [Globalization.UnicodeCategory]::NonSpacingMark) {
      continue
    }

    if ([char]::IsLetterOrDigit($char)) {
      [void]$builder.Append([char]::ToLowerInvariant($char))
    }
    else {
      [void]$builder.Append('-')
    }
  }

  return ($builder.ToString() -replace '-+', '-').Trim('-')
}

function Build-PlatformLookupKey($Brand, $Model, $GenerationLabel, $Engine) {
  $parts = @($Brand, $Model, $GenerationLabel, $Engine)
  $normalizedParts = foreach ($part in $parts) {
    $value = $part.ToString().Trim().Normalize([Text.NormalizationForm]::FormD)
    $builder = New-Object System.Text.StringBuilder

    foreach ($char in $value.ToCharArray()) {
      $unicode = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)

      if ($unicode -eq [Globalization.UnicodeCategory]::NonSpacingMark) {
        continue
      }

      [void]$builder.Append([char]::ToLowerInvariant($char))
    }

    $builder.ToString()
  }

  return $normalizedParts -join '|'
}

function Read-SheetRows($Worksheet) {
  $usedRange = $Worksheet.UsedRange
  $rowCount = $usedRange.Rows.Count
  $columnCount = $usedRange.Columns.Count

  $headers = @()
  for ($column = 1; $column -le $columnCount; $column += 1) {
    $headers += [string]$Worksheet.Cells.Item(1, $column).Text
  }

  $rows = @()

  for ($row = 2; $row -le $rowCount; $row += 1) {
    $entry = [ordered]@{}
    $hasValues = $false

    for ($column = 1; $column -le $columnCount; $column += 1) {
      $header = $headers[$column - 1]

      if ([string]::IsNullOrWhiteSpace($header)) {
        continue
      }

      $value = $Worksheet.Cells.Item($row, $column).Text

      if (-not [string]::IsNullOrWhiteSpace($value)) {
        $hasValues = $true
      }

      $entry[$header] = $value
    }

    if ($hasValues) {
      $rows += [pscustomobject]$entry
    }
  }

  return $rows
}

function Get-StageName($Category) {
  switch ($Category) {
    "Electrónica" { return "STAGE 1" }
    "Admisión" { return "STAGE 1" }
    "Escape" { return "STAGE 1" }
    "Intercooler" { return "STAGE 2" }
    "Turbo" { return "STAGE 3" }
    "Suspensión" { return "STAGE 3" }
    "Frenos" { return "STAGE 3" }
    default { return "STAGE 2" }
  }
}

function Get-StageFocus($Stage) {
  switch ($Stage) {
    "STAGE 1" { return "Base y respuesta" }
    "STAGE 2" { return "Flujo y rendimiento" }
    "STAGE 3" { return "Soporte y puesta a punto" }
    default { return "Mejora general" }
  }
}

function Get-ReliabilityIndex($Categories, $Fuel) {
  $score = 88

  if ($Fuel -eq "Diesel") {
    $score += 2
  }

  if ($Categories -contains "Turbo") {
    $score -= 5
  }

  if ($Categories -contains "Suspensión") {
    $score += 1
  }

  return [Math]::Max(74, [Math]::Min(94, $score))
}

function Infer-Usage($Power) {
  if ($Power -ge 220) {
    return "finde"
  }

  return "diario"
}

function Infer-Goal($Categories, $Power) {
  if (($Categories -contains "Suspensión") -and ($Categories -contains "Frenos") -and $Power -ge 180) {
    return "tandas"
  }

  return "calle"
}

function Infer-Priority($Fuel, $Power, $Categories) {
  if ($Fuel -eq "Diesel") {
    return "fiabilidad"
  }

  if (($Categories -contains "Electrónica") -or ($Categories -contains "Turbo") -or $Power -ge 180) {
    return "potencia"
  }

  return "equilibrio"
}

function Infer-Budget($Categories) {
  $count = $Categories.Count

  if ($Categories -contains "Turbo" -or $count -ge 5) {
    return "alto"
  }

  if ($count -ge 3) {
    return "medio"
  }

  return "bajo"
}

function Get-BudgetAmount($Budget) {
  switch ($Budget) {
    "alto" { return 6200 }
    "medio" { return 3800 }
    default { return 1800 }
  }
}

function Get-ExecutionTime($Budget) {
  switch ($Budget) {
    "alto" { return "3 a 5 semanas" }
    "medio" { return "2 a 3 semanas" }
    default { return "1 a 2 semanas" }
  }
}

$resolvedInputPath = Resolve-ProjectPath $InputPath
$resolvedOutputPath = Resolve-ProjectPath $OutputPath
$resolvedOutputDirectory = Split-Path -Parent $resolvedOutputPath

if (-not (Test-Path $resolvedInputPath)) {
  throw "No se ha encontrado el archivo Excel en $resolvedInputPath"
}

if (-not (Test-Path $resolvedOutputDirectory)) {
  New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
  $workbook = $excel.Workbooks.Open($resolvedInputPath)
  $motoresSheet = $workbook.Worksheets.Item("Motores")
  $recomendacionesSheet = $workbook.Worksheets.Item("Recomendaciones")

  $motoresRows = Read-SheetRows $motoresSheet
  $recomendacionesRows = Read-SheetRows $recomendacionesSheet

  $motorMap = @{}

  foreach ($motor in $motoresRows) {
    $generationLabel = "$($motor.generacion) ($($motor.anio_inicio)-$($motor.anio_fin))"
    $lookupKey = Build-PlatformLookupKey $motor.marca $motor.modelo $generationLabel $motor.motor

    $motorMap[$lookupKey] = [pscustomobject]@{
      Brand = $motor.marca
      Model = $motor.modelo
      Generation = $motor.generacion
      GenerationLabel = $generationLabel
      YearStart = [int]$motor.anio_inicio
      YearEnd = [int]$motor.anio_fin
      Engine = $motor.motor
      Fuel = $motor.combustible
      Power = [int]$motor.potencia_cv
    }
  }

  $recommendationsByKey = @{}

  foreach ($recommendation in $recomendacionesRows) {
    $motorMatch = $motoresRows | Where-Object {
      $_.marca -eq $recommendation.marca -and
      $_.modelo -eq $recommendation.modelo -and
      $_.generacion -eq $recommendation.generacion -and
      $_.motor -eq $recommendation.motor
    } | Select-Object -First 1

    if (-not $motorMatch) {
      continue
    }

    $generationLabel = "$($motorMatch.generacion) ($($motorMatch.anio_inicio)-$($motorMatch.anio_fin))"
    $lookupKey = Build-PlatformLookupKey $recommendation.marca $recommendation.modelo $generationLabel $recommendation.motor

    if (-not $recommendationsByKey.ContainsKey($lookupKey)) {
      $recommendationsByKey[$lookupKey] = @()
    }

    $recommendationsByKey[$lookupKey] += [pscustomobject]@{
      Category = $recommendation.categoria
      Cost = $recommendation.coste_estimado
      Gain = if ([string]::IsNullOrWhiteSpace($recommendation.ganancia_cv_estimada)) { 0 } else { [int]$recommendation.ganancia_cv_estimada }
      Description = $recommendation.descripcion
      Note = $recommendation.nota
    }
  }

  $builds = @()

  foreach ($lookupKey in $recommendationsByKey.Keys) {
    $motor = $motorMap[$lookupKey]

    if (-not $motor) {
      continue
    }

    $recommendations = $recommendationsByKey[$lookupKey]
    $categories = @($recommendations | ForEach-Object { $_.Category } | Select-Object -Unique)
    $budget = Infer-Budget $categories
    $usage = Infer-Usage $motor.Power
    $goal = Infer-Goal $categories $motor.Power
    $priority = Infer-Priority $motor.Fuel $motor.Power $categories
    $estimatedBudget = Get-BudgetAmount $budget
    $reliabilityIndex = Get-ReliabilityIndex $categories $motor.Fuel
    $fitScore = [Math]::Max(82, [Math]::Min(96, $reliabilityIndex + 2))
    $totalGain = ($recommendations | Measure-Object -Property Gain -Sum).Sum

    $stageBuckets = [ordered]@{
      "STAGE 1" = @()
      "STAGE 2" = @()
      "STAGE 3" = @()
    }

    foreach ($recommendation in $recommendations) {
      $stageName = Get-StageName $recommendation.Category
      $stageBuckets[$stageName] += $recommendation
    }

    $stages = @()

    foreach ($stageName in $stageBuckets.Keys) {
      $items = $stageBuckets[$stageName]

      if ($items.Count -eq 0) {
        continue
      }

      $partNames = @()
      foreach ($item in $items) {
        $partNames += $item.Description
      }

      $cleanParts = @($partNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)

      if ($cleanParts.Count -eq 0) {
        $cleanParts = @($items | ForEach-Object { $_.Category } | Select-Object -Unique)
      }

      $noteParts = @($items | ForEach-Object { $_.Note } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)

      $stages += [pscustomobject]@{
        label = $stageName
        focus = Get-StageFocus $stageName
        parts = $cleanParts
        note = if ($noteParts.Count -gt 0) { ($noteParts -join ' ') } else { "Etapa pensada para una evolucion coherente y utilizable." }
      }
    }

    $reasons = @(
      "$($motor.Brand) $($motor.Model) $($motor.GenerationLabel) con motor $($motor.Engine) tiene una base muy reconocible dentro del tuning de calle."
      "La propuesta combina $((@($categories | ForEach-Object { $_.ToLower() }) -join ', ')) para que la build tenga una evolucion real y no se quede en una sola pieza."
      "La seleccion prioriza una receta equilibrada para un uso $usage, respetando la base mecanica del coche."
    )

    $warnings = @()
    if ($categories -contains "Turbo") {
      $warnings += "Si se sube mucho de nivel, conviene revisar temperaturas, combustible y soporte mecanico."
    }
    if ($motor.Fuel -eq "Diesel") {
      $warnings += "En diesel hay que vigilar embrague, humos y entrega de par si se aprieta la electronica."
    }
    $warnings += "Antes de cerrar la build, revisa homologacion, ITV y compatibilidad real de las piezas."

    $builds += [pscustomobject]@{
      id = "$(Slugify $motor.Brand)-$(Slugify $motor.Model)-$(Slugify $motor.Generation)-$(Slugify $motor.Engine)"
      platformLookupKey = $lookupKey
      brand = $motor.Brand
      model = $motor.Model
      generation = $motor.GenerationLabel
      engine = $motor.Engine
      powertrain = $motor.Fuel.ToLowerInvariant()
      yearStart = $motor.YearStart
      yearEnd = $motor.YearEnd
      usage = $usage
      goal = $goal
      priority = $priority
      budget = $budget
      fitScore = $fitScore
      name = "$($motor.Model) $($motor.Generation) $($motor.Engine)"
      summary = "Build recomendada para $($motor.Model) $($motor.GenerationLabel) $($motor.Engine), organizada por etapas para mejorar respuesta, comportamiento y coherencia general."
      estimatedBudget = $estimatedBudget
      expectedGain = if ($totalGain -gt 0) { "+$totalGain cv aprox." } else { "Ganancia moderada segun configuracion" }
      reliabilityIndex = $reliabilityIndex
      executionTime = Get-ExecutionTime $budget
      stages = $stages
      reasons = $reasons
      warnings = @($warnings | Select-Object -Unique)
      isFeatured = ($motor.Power -ge 170 -or $categories -contains "Turbo")
    }
  }

  $output = [pscustomobject]@{
    builds = $builds
  }

  $output | ConvertTo-Json -Depth 10 | Set-Content -Path $resolvedOutputPath -Encoding UTF8

  Write-Output "Dataset generado en $resolvedOutputPath"
  Write-Output "Builds creadas: $($builds.Count)"
}
finally {
  if ($workbook) {
    $workbook.Close($false)
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
  }

  if ($excel) {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
