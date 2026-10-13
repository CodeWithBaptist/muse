# Share image font

`fredoka-latin-500.ttf` is a static weight 500 instance of the existing bundled Fredoka Variable Latin font from `@fontsource-variable/fredoka`. The UI already uses this family. Its SIL Open Font License is preserved in `OFL.txt`.

The share-image renderer needs a local TTF rather than WOFF2. The asset was converted with an already available FontTools utility; no project dependency was added. The build reads this committed file locally and makes no font network request. The SVG wordmark does not use the font.
