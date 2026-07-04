export abstract class NodeDOMFactory {
  public abstract createDOM(type: string): SVGElement;
  public abstract createSelectionBox(): {
    uuid: string;
    elements: Map<string, SVGElement>;
  };

  protected createSvgElement<K extends keyof SVGElementTagNameMap>(
    tagName: K,
  ): SVGElementTagNameMap[K] {
    return document.createElementNS(
      'http://www.w3.org/2000/svg',
      tagName,
    ) as SVGElementTagNameMap[K];
  }
}
