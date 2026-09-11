#!/usr/bin/env python3
"""Inline everything into one HTML fragment for publishing as an Artifact."""
import pathlib
root = pathlib.Path(__file__).parent
style = (root/'style.css').read_text()
js = '\n'.join((root/f).read_text() for f in ['icons.js','fluid.js','gpu.js','gpu3d.js','content.js','chapters.js','lab.js','app.js'])
out = f"""<title>Fluid Lab</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@700;800;900&family=Rubik:wght@700;800;900&display=swap">
<style>
{style}
html {{ color-scheme: light; }}
</style>
<header class="topbar">
  <div class="brand">
    <span class="logo">💧</span>
    <span class="name" data-ui="brand">Fluid Lab</span>
    <span class="tag" data-ui="tagline"></span>
  </div>
  <nav class="chapter-map" id="chapterMap" aria-label="Chapters"></nav>
  <div class="tools">
    <button class="top-btn" id="lookBtn" type="button"></button>
    <button class="top-btn" id="langBtn" type="button">עברית</button>
  </div>
</header>
<main class="stage">
  <section class="lab" id="lab"></section>
  <section class="lesson" id="lesson" aria-live="polite"></section>
</main>
<script>
{js}
</script>
"""
(root/'dist').mkdir(exist_ok=True)
(root/'dist'/'fluid-lab.html').write_text(out)
print('wrote dist/fluid-lab.html', len(out)//1024, 'KB')
