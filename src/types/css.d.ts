/** Vite's `?inline` CSS imports — the stylesheet's text as a string. */
declare module "*.css?inline" {
  const css: string;
  export default css;
}
