-- Generiert von seed/to-sql.mjs – nicht von Hand bearbeiten.
-- Quelle: seed/questions.de.json (40 Fragen)

insert into categories (slug, label_de, label_en) values ('geographie', 'Geographie', 'Geography') on conflict (slug) do nothing;
insert into categories (slug, label_de, label_en) values ('wissenschaft', 'Wissenschaft', 'Science') on conflict (slug) do nothing;
insert into categories (slug, label_de, label_en) values ('geschichte', 'Geschichte', 'History') on conflict (slug) do nothing;
insert into categories (slug, label_de, label_en) values ('kultur', 'Kultur', 'Culture') on conflict (slug) do nothing;

insert into questions (category_id, locale, text, options, correct_index, status)
  select id, 'de', 'Wie heißt die Hauptstadt Australiens?', array['Sydney', 'Melbourne', 'Canberra', 'Perth'], 2, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Welcher ist der längste Fluss Afrikas?', array['Kongo', 'Nil', 'Niger', 'Sambesi'], 1, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'An welches Meer grenzt Polen?', array['Nordsee', 'Schwarzes Meer', 'Ostsee', 'Adria'], 2, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Wie heißt der höchste Berg Afrikas?', array['Mount Kenya', 'Kilimandscharo', 'Ruwenzori', 'Atlas'], 1, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Welche Stadt liegt an der Themse?', array['Dublin', 'Edinburgh', 'London', 'Cardiff'], 2, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Welches ist die größte Insel der Welt?', array['Neuguinea', 'Borneo', 'Madagaskar', 'Grönland'], 3, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Welches dieser Länder grenzt NICHT an Deutschland?', array['Dänemark', 'Tschechien', 'Ungarn', 'Belgien'], 2, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Wie heißt die Hauptstadt Kanadas?', array['Toronto', 'Ottawa', 'Vancouver', 'Montreal'], 1, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'In welchem Gebirge liegt der Mount Everest?', array['Anden', 'Alpen', 'Himalaya', 'Kaukasus'], 2, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Welcher Kontinent hat die kleinste Landfläche?', array['Europa', 'Australien', 'Antarktis', 'Südamerika'], 1, 'live' from categories where slug = 'geographie'
  union all
  select id, 'de', 'Welches chemische Symbol steht für Gold?', array['Ag', 'Au', 'Go', 'Gd'], 1, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Wie viele Knochen hat ein erwachsener Mensch typischerweise?', array['186', '206', '236', '256'], 1, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Welches Gas nehmen Pflanzen bei der Fotosynthese auf?', array['Sauerstoff', 'Stickstoff', 'Kohlendioxid', 'Wasserstoff'], 2, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Welcher Planet ist der Sonne am nächsten?', array['Venus', 'Merkur', 'Mars', 'Erde'], 1, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Wer formulierte die Relativitätstheorie?', array['Isaac Newton', 'Niels Bohr', 'Albert Einstein', 'Max Planck'], 2, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Wie viele Beine hat eine Spinne?', array['6', '8', '10', '12'], 1, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Was misst ein Barometer?', array['Luftfeuchtigkeit', 'Luftdruck', 'Temperatur', 'Windgeschwindigkeit'], 1, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Welches Organ produziert Insulin?', array['Leber', 'Niere', 'Bauchspeicheldrüse', 'Milz'], 2, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Bei wie viel Grad Celsius gefriert Wasser unter Normaldruck?', array['-10', '0', '4', '10'], 1, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'Welches chemische Symbol steht für Eisen?', array['Ei', 'Fe', 'Ir', 'In'], 1, 'live' from categories where slug = 'wissenschaft'
  union all
  select id, 'de', 'In welchem Jahr fiel die Berliner Mauer?', array['1987', '1989', '1990', '1991'], 1, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'Wer betrat als erster Mensch den Mond?', array['Juri Gagarin', 'Buzz Aldrin', 'Neil Armstrong', 'Michael Collins'], 2, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'In welchem Jahr begann der Erste Weltkrieg?', array['1912', '1914', '1916', '1918'], 1, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'Wer war der erste Bundeskanzler der Bundesrepublik Deutschland?', array['Ludwig Erhard', 'Willy Brandt', 'Konrad Adenauer', 'Kurt Georg Kiesinger'], 2, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'In welchem Jahr endete der Zweite Weltkrieg in Europa?', array['1943', '1944', '1945', '1946'], 2, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'Welches Passagierschiff sank 1912 auf seiner Jungfernfahrt?', array['Lusitania', 'Titanic', 'Britannic', 'Olympic'], 1, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'Wer entwickelte in Europa den Buchdruck mit beweglichen Lettern?', array['Johannes Gutenberg', 'Martin Luther', 'Albrecht Dürer', 'Nikolaus Kopernikus'], 0, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'Welche antike Stadt wurde 79 n. Chr. vom Vesuv verschüttet?', array['Ostia', 'Pompeji', 'Syrakus', 'Karthago'], 1, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'In welchem Jahr stürmten Pariser die Bastille?', array['1776', '1789', '1799', '1815'], 1, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'Wer war die erste Frau im Weltraum?', array['Sally Ride', 'Walentina Tereschkowa', 'Mae Jemison', 'Swetlana Sawizkaja'], 1, 'live' from categories where slug = 'geschichte'
  union all
  select id, 'de', 'Wer malte die Mona Lisa?', array['Michelangelo', 'Raffael', 'Leonardo da Vinci', 'Sandro Botticelli'], 2, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Wer schrieb das Drama „Faust“?', array['Friedrich Schiller', 'Johann Wolfgang von Goethe', 'Heinrich Heine', 'Gotthold Ephraim Lessing'], 1, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Wie viele Saiten hat eine Standardgitarre?', array['4', '5', '6', '7'], 2, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Welches Instrument spielte Louis Armstrong?', array['Saxofon', 'Trompete', 'Klarinette', 'Posaune'], 1, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Wer komponierte die Neunte Sinfonie mit der „Ode an die Freude“?', array['Johannes Brahms', 'Ludwig van Beethoven', 'Franz Schubert', 'Wolfgang Amadeus Mozart'], 1, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'In welchem Land steht das Taj Mahal?', array['Pakistan', 'Indien', 'Iran', 'Bangladesch'], 1, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Wer schrieb „Romeo und Julia“?', array['Christopher Marlowe', 'William Shakespeare', 'Ben Jonson', 'John Milton'], 1, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Welche Farbe entsteht beim Mischen von Blau und Gelb?', array['Orange', 'Violett', 'Grün', 'Braun'], 2, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Wer schrieb die Erzählung „Die Verwandlung“?', array['Thomas Mann', 'Franz Kafka', 'Robert Musil', 'Hermann Hesse'], 1, 'live' from categories where slug = 'kultur'
  union all
  select id, 'de', 'Wie viele Tasten hat ein modernes Konzertklavier?', array['76', '84', '88', '92'], 2, 'live' from categories where slug = 'kultur';
