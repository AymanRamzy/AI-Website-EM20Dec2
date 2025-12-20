-- Atomic Team Creation Function
-- Creates team and adds leader as member in a single transaction
-- If either insert fails, the entire operation is rolled back

CREATE OR REPLACE FUNCTION create_team_with_leader(
  p_team_name TEXT,
  p_competition_id UUID,
  p_user_id UUID,
  p_user_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_team teams;
BEGIN
  -- Insert team (leader_id determines who is the leader/CFO)
  INSERT INTO teams (team_name, competition_id, leader_id)
  VALUES (p_team_name, p_competition_id, p_user_id)
  RETURNING * INTO v_team;

  -- Insert leader as team member (team_role is NULL - leader is derived from teams.leader_id)
  INSERT INTO team_members (team_id, user_id, user_name)
  VALUES (v_team.id, p_user_id, p_user_name);

  -- Return the created team as JSON
  RETURN row_to_json(v_team);
END;
$$;
