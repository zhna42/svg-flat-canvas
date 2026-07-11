/* eslint-disable custom-rules/no-dom-api */
import FontManager, {
  type FontItem,
  type FontVariant,
  type FontStyle,
  type VariantMetadata,
  type LoadingState,
} from 'omnifont';

export interface FontListItem {
  family: string;
  category: string;
  weights: string[];
  hasItalic: boolean;
}

/**
 * Обёртка над omnifont: каталог Google Fonts, поиск, загрузка вариантов
 * (через FontFace API — полное покрытие глифов) и метаданные для UI.
 */
export class FontService {
  private fm: FontManager | null = null;
  private catalog: FontItem[] = [];
  private loaded = new Set<string>();
  private inited = false;

  public async init(apiKey: string): Promise<void> {
    if (this.inited) return;
    this.fm = new FontManager({ apiKey });
    this.catalog = await this.fm.init();
    this.inited = true;
  }

  public get isReady(): boolean {
    return this.inited;
  }

  public onLoading(listener: (s: LoadingState) => void): () => void {
    return this.fm ? this.fm.onLoading(listener) : () => {};
  }

  public search(query: string, category?: string): FontListItem[] {
    if (!this.fm) return [];
    const items =
      query || category ? this.fm.search(query, category) : this.catalog;
    return items.slice(0, 200).map((f) => this.toListItem(f));
  }

  public getVariants(family: string): VariantMetadata | null {
    const font = this.findFont(family);
    if (!font || !this.fm) return null;
    return this.fm.getVariantMetadata(font);
  }

  /**
   * Гарантирует загрузку варианта шрифта (инжект в document.fonts).
   * Возвращает CSS font-family для применения.
   */
  public async ensureLoaded(
    family: string,
    weight: string,
    style: FontStyle,
  ): Promise<string> {
    const key = `${family}|${weight}|${style}`;
    if (this.loaded.has(key)) return family;

    const font = this.findFont(family);
    if (!font || !this.fm) return family; // системный/неизвестный — как есть

    const variant = this.fm.resolveVariant(font, weight, style);
    this.fm.select(font, variant.id);
    const res = await this.fm.confirm();

    if (typeof FontFace !== 'undefined') {
      const face = new FontFace(family, res.buffer, {
        weight,
        style,
      });
      await face.load();
      (document as unknown as { fonts: FontFaceSet }).fonts.add(face);
    }
    this.loaded.add(key);
    return family;
  }

  private findFont(family: string): FontItem | undefined {
    return this.catalog.find((f) => f.family === family);
  }

  private toListItem(f: FontItem): FontListItem {
    const meta = this.fm!.getVariantMetadata(f);
    return {
      family: f.family,
      category: f.category,
      weights: meta.weights,
      hasItalic: meta.hasItalic,
    };
  }
}

export type { FontVariant, FontStyle, VariantMetadata };
