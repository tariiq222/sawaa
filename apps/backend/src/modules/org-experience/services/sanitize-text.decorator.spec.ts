import { plainToInstance } from 'class-transformer';
import { SanitizeText } from './sanitize-text.decorator';

/**
 * The SanitizeText decorator is a class-transformer @Transform that runs
 * before @IsString validation. We verify behaviour by instantiating a
 * test class through plainToInstance (the path used by the global
 * ValidationPipe) and asserting the post-transform value.
 */
class SanitizeProbe {
  @SanitizeText()
  text!: string;
}

const transform = (input: unknown) =>
  plainToInstance(SanitizeProbe, { text: input });

describe('SanitizeText (XSS guard)', () => {
  it('strips a simple HTML tag', () => {
    const result = transform('<b>hello</b>');
    expect((result as SanitizeProbe).text).toBe('hello');
  });

  it('strips nested HTML tags', () => {
    const result = transform('<div><span>nested</span> text</div>');
    expect((result as SanitizeProbe).text).toBe('nested text');
  });

  it('strips tags with attributes (event handlers, URLs, etc.)', () => {
    const result = transform('<a href="javascript:alert(1)" onclick="x">click</a>');
    expect((result as SanitizeProbe).text).toBe('click');
  });

  it('strips <script> opening and closing tags (text between them remains — pair with CSP)', () => {
    // The decorator is a tag stripper, not an HTML/script interpreter.
    // The angle brackets go; the body of the script is plain text.
    // Production code pairs this with Content-Security-Policy to neutralise
    // any remaining inline script body.
    const result = transform('<script>alert("xss")</script>safe');
    expect((result as SanitizeProbe).text).toBe('alert("xss")safe');
  });

  it('strips stray closing angle brackets left over after tag removal', () => {
    const result = transform('a > b < c');
    expect((result as SanitizeProbe).text).toBe('a  b  c');
  });

  it('trims surrounding whitespace after stripping', () => {
    const result = transform('   <em>hi</em>   ');
    expect((result as SanitizeProbe).text).toBe('hi');
  });

  it('leaves benign text completely untouched', () => {
    const result = transform('Haircut & styling, 60 minutes');
    expect((result as SanitizeProbe).text).toBe('Haircut & styling, 60 minutes');
  });

  it('leaves an empty string empty', () => {
    const result = transform('');
    expect((result as SanitizeProbe).text).toBe('');
  });

  it('strips self-closing tags', () => {
    const result = transform('before<br/>after');
    expect((result as SanitizeProbe).text).toBe('beforeafter');
  });

  it('strips <img> tag with onerror payload', () => {
    const result = transform('<img src=x onerror=alert(1)>safe');
    expect((result as SanitizeProbe).text).toBe('safe');
  });

  it('returns non-string primitive values untouched (lets @IsString report the type mismatch)', () => {
    // class-transformer's plainToInstance may not preserve object identity
    // through its copy step, but the decorator itself is a no-op for non-strings.
    expect((transform(null) as SanitizeProbe).text).toBeNull();
    expect((transform(undefined) as SanitizeProbe).text).toBeUndefined();
    expect((transform(42) as SanitizeProbe).text).toBe(42);
    // For an object, the decorator is a no-op; plainToInstance may still
    // re-instantiate, so we assert deep equality, not identity.
    expect((transform({ a: 1 }) as SanitizeProbe).text).toEqual({ a: 1 });
  });
});
