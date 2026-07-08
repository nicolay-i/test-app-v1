# Semantic UI Representation Template

Use this instead of raw HTML for text-only models.

```xml
<screen name="<Screen Name>" viewport="1440x900">
  <layout type="app-shell | centered | dashboard | board | document">
    <region name="header">
      <title level="1">Visible title</title>
      <button role="primary-action">Action</button>
    </region>

    <region name="main">
      <section name="Primary section">
        <component type="card" purpose="summary">
          <label>Label</label>
          <value>Value</value>
        </component>
      </section>
    </region>
  </layout>

  <style>
    <background>light neutral</background>
    <spacing>comfortable, 24px section gaps</spacing>
    <typography>clear hierarchy</typography>
    <components>rounded cards, subtle borders</components>
  </style>

  <responsive>
    <desktop>multi-column layout</desktop>
    <mobile>single-column layout, navigation collapses</mobile>
  </responsive>
</screen>
```

Rules:

```text
- Include visible text.
- Include element roles.
- Include layout structure.
- Include responsive behavior.
- Do not include noisy generated classes.
- Do not include hidden analytics/portal nodes.
```
