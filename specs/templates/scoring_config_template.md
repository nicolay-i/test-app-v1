# Scoring Config Template

```yaml
initialQuality:
  buildRuntime: 0.25
  e2e: 0.35
  values: 0.15
  visual: 0.15
  promptAdherence: 0.10

versionQuality:
  buildRuntime: 0.20
  regression: 0.35
  newFeature: 0.25
  values: 0.10
  visual: 0.10

maintainability:
  survival: 0.25
  regressionResistance: 0.20
  changeLocality: 0.15
  duplicationControl: 0.15
  complexityControl: 0.10
  tokenGrowthControl: 0.10
  deadCodeCleanup: 0.05

overengineeringPenalty:
  enabled: true
  maxPenalty: 0.15
  rules:
    extraDependencies: 0.03
    excessiveFilesForSmallTask: 0.03
    unusedAbstractions: 0.03
    lowFunctionalityHighLoc: 0.03
    needlessStateLibrary: 0.03

lifecycleQuality:
  initialQuality: 0.20
  averageVersionQuality: 0.30
  survivalScore: 0.20
  maintainabilityScore: 0.20
  regressionResistance: 0.10

jury:
  includeInFinalScore: false
  dimensions:
    functionalCorrectness: 0.25
    visualQuality: 0.15
    uxCompleteness: 0.15
    maintainability: 0.25
    codeReadability: 0.10
    overallQuality: 0.10
```
