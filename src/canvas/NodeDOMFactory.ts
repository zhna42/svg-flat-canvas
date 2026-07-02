export abstract class NodeDOMFactory {
  public abstract createDOM(type: string): SVGElement;

  protected createSvgElement<K extends keyof SVGElementTagNameMap>(
    tagName: K,
  ): SVGElementTagNameMap[K] {
    return document.createElementNS('http://w3.org', tagName);
  }
}
