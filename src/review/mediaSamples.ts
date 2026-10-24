import {musicRows,artwork} from '../../scripts/test/fixtures/moa-music-data.mjs';
import {bookTables,cover,photo} from '../../scripts/test/fixtures/moa-books-data.mjs';
import albumImage from './media-assets/album.svg';
import bookImage from './media-assets/book.svg';
import quoteImage from './media-assets/quote.svg';
import audio from './media-assets/sample.wav?url';
export const mediaImages:Record<string,string>={[artwork]:albumImage,'https://music.example.invalid/art.svg':albumImage,[cover]:bookImage,[photo]:quoteImage};
export const mediaAudio:Record<string,string>={'https://music.example.invalid/preview.wav':audio};
export const sampleMediaTables={...bookTables,music_records:musicRows};
