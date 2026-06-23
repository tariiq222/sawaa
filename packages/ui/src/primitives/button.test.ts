import { describe, it, expect } from 'vitest';
import { buttonVariants } from './button';

/**
 * `buttonVariants` is a class-variance-authority cva() builder. These tests assert
 * the expected class substring for each representative variant×size combo so
 * accidental class-name regressions (e.g. renaming `bg-primary` → `bg-primary-bg`)
 * are caught by CI.
 */
describe('buttonVariants', () => {
  describe('variants', () => {
    it('default variant exposes the primary background + foreground', () => {
      const cls = buttonVariants({ variant: 'default' });
      expect(cls).toContain('bg-primary');
      expect(cls).toContain('text-primary-foreground');
      // Every variant also shares the base "group/button" root class.
      expect(cls).toContain('group/button');
    });

    it('destructive variant uses the destructive token, not the primary token', () => {
      const cls = buttonVariants({ variant: 'destructive' });
      expect(cls).toContain('text-destructive');
      expect(cls).toContain('bg-destructive');
      // Destructive must NOT inherit the default primary background.
      expect(cls).not.toContain('bg-primary ');
      expect(cls).not.toContain('bg-primary/90');
    });

    it('outline variant uses a background + border, not the primary fill', () => {
      const cls = buttonVariants({ variant: 'outline' });
      expect(cls).toContain('border-border');
      expect(cls).toContain('bg-background');
      expect(cls).toContain('hover:bg-muted');
    });

    it('ghost variant has no background fill at rest, hover only', () => {
      const cls = buttonVariants({ variant: 'ghost' });
      expect(cls).toContain('hover:bg-muted');
      expect(cls).toContain('hover:text-foreground');
    });

    it('secondary variant uses the secondary token, not the primary token', () => {
      const cls = buttonVariants({ variant: 'secondary' });
      expect(cls).toContain('bg-secondary');
      expect(cls).toContain('text-secondary-foreground');
      expect(cls).not.toContain('bg-primary ');
    });

    it('link variant is text-only (no background) and underlines on hover', () => {
      const cls = buttonVariants({ variant: 'link' });
      expect(cls).toContain('text-primary');
      expect(cls).toContain('hover:underline');
    });

    it('accent variant uses the accent token + a custom shadow', () => {
      const cls = buttonVariants({ variant: 'accent' });
      expect(cls).toContain('bg-accent');
      expect(cls).toContain('text-accent-foreground');
      expect(cls).toContain('shadow-[');
    });
  });

  describe('sizes', () => {
    it('default size uses h-8', () => {
      const cls = buttonVariants({ size: 'default' });
      expect(cls).toContain('h-8');
    });

    it('sm size uses h-7 and the small text class', () => {
      const cls = buttonVariants({ size: 'sm' });
      expect(cls).toContain('h-7');
      expect(cls).toContain('text-xs');
    });

    it('lg size uses h-9', () => {
      const cls = buttonVariants({ size: 'lg' });
      expect(cls).toContain('h-9');
    });

    it('icon size is a 9×9 square', () => {
      const cls = buttonVariants({ size: 'icon' });
      expect(cls).toContain('size-9');
      // The icon size must NOT include the horizontal padding of the default size.
      expect(cls).not.toContain('h-8');
    });

    it('xs size uses h-6', () => {
      const cls = buttonVariants({ size: 'xs' });
      expect(cls).toContain('h-6');
      expect(cls).toContain('text-xs');
    });
  });

  describe('default variants', () => {
    it('falls back to variant=default and size=default when neither is given', () => {
      const cls = buttonVariants({});
      // Default variant markers
      expect(cls).toContain('bg-primary');
      // Default size markers
      expect(cls).toContain('h-8');
    });
  });

  describe('variant × size composition', () => {
    it('destructive + sm combines both class substrings', () => {
      const cls = buttonVariants({ variant: 'destructive', size: 'sm' });
      expect(cls).toContain('text-destructive');
      expect(cls).toContain('h-7');
      expect(cls).toContain('text-xs');
    });

    it('outline + lg combines both class substrings', () => {
      const cls = buttonVariants({ variant: 'outline', size: 'lg' });
      expect(cls).toContain('border-border');
      expect(cls).toContain('h-9');
    });

    it('ghost + icon combines both class substrings', () => {
      const cls = buttonVariants({ variant: 'ghost', size: 'icon' });
      expect(cls).toContain('hover:bg-muted');
      expect(cls).toContain('size-9');
    });
  });

  describe('base classes (always present)', () => {
    it('shares the "group/button" + focus-visible + transition root classes', () => {
      const cls = buttonVariants({});
      expect(cls).toContain('group/button');
      expect(cls).toContain('focus-visible:border-ring');
      expect(cls).toContain('transition-all');
      expect(cls).toContain('disabled:pointer-events-none');
      expect(cls).toContain('aria-invalid:border-destructive');
    });
  });
});
