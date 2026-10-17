-- A small fictional demo family so you can explore Hiraya before entering your own.
-- Safe to run once; uses fixed ids so re-running does nothing.
insert into persons (id, first_name, last_name, nickname, gender, birth_date, birth_place, is_deceased, death_date, occupation, biography) values
  ('00000000-0000-4000-8000-000000000001', 'Benito', 'Santos', 'Lolo Ben', 'male', '1931-04-12', 'Lipa, Batangas', true, '2009-11-02', 'Coffee farmer',
   'Lolo Ben planted the first coffee trees on the hill behind the house.

He woke before the roosters and always came home with something in his pockets for the grandchildren.'),
  ('00000000-0000-4000-8000-000000000002', 'Remedios', 'Santos', 'Lola Remy', 'female', '1935-09-30', 'Tanauan, Batangas', false, null, 'Schoolteacher',
   'Lola Remy taught three generations of the town to read. Her kare-kare is still the centerpiece of every reunion.'),
  ('00000000-0000-4000-8000-000000000003', 'Arturo', 'Santos', 'Tito Art', 'male', '1958-02-03', 'Lipa, Batangas', false, null, 'Engineer', null),
  ('00000000-0000-4000-8000-000000000004', 'Carmela', 'Reyes', 'Tita Mela', 'female', '1961-07-21', 'Quezon City', false, null, 'Nurse', null),
  ('00000000-0000-4000-8000-000000000005', 'Luz', 'Santos', null, 'female', '1963-12-08', 'Lipa, Batangas', false, null, 'Baker', null),
  ('00000000-0000-4000-8000-000000000006', 'Miguel', 'Santos', 'Migs', 'male', '1990-05-14', 'Manila', false, null, 'Designer', null),
  ('00000000-0000-4000-8000-000000000007', 'Isabel', 'Santos', 'Isay', 'female', '1993-10-17', 'Manila', false, null, 'Doctor', null),
  ('00000000-0000-4000-8000-000000000008', 'Tala', 'Santos', null, 'female', '2021-03-09', 'Antipolo, Rizal', false, null, null, null)
on conflict (id) do nothing;

update persons set death_date_precision = 'day' where id = '00000000-0000-4000-8000-000000000001';

insert into partnerships (person_a, person_b, kind, status, start_date, place) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'married', 'widowed', '1956-06-16', 'San Sebastian Cathedral, Lipa'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'married', 'current', '1988-01-23', 'Quezon City')
on conflict do nothing;

insert into parent_child (parent_id, child_id, kind) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'biological'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'biological'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'biological'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', 'biological'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000006', 'biological'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000006', 'biological'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000007', 'adopted'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000007', 'adopted'),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000008', 'biological')
on conflict do nothing;

insert into events (id, title, description, kind, event_date, location, recurring) values
  ('00000000-0000-4000-8000-0000000000e1', 'First Santos family reunion', 'Forty-two cousins under the mango tree.', 'reunion', '1999-12-27', 'Lipa, Batangas', false),
  ('00000000-0000-4000-8000-0000000000e2', 'Family Day', 'Our yearly gathering at the farm.', 'celebration', '2000-12-27', 'Lipa, Batangas', true)
on conflict (id) do nothing;

insert into stories (id, title, kind, body, story_date) values
  ('00000000-0000-4000-8000-0000000000a1', 'Lola Remy''s kare-kare', 'recipe',
   'Ingredients:
- 1 kilo oxtail
- 1 cup ground roasted peanuts
- 1/4 cup toasted rice, ground
- string beans, eggplant, bok choy

Steps:
1. Simmer the oxtail low and slow until tender — Lola says three hours, never less.
2. Stir in the peanuts and rice to thicken.
3. Add vegetables at the very end so they stay green.

Lola''s secret: a spoonful of the bagoong goes in the pot, not just on the side.', null)
on conflict (id) do nothing;
