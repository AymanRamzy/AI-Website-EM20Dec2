from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from supabase_client import get_supabase_client
from auth import get_current_user, get_admin_user
from models import (User, UserCreate, UserLogin, UserResponse, UserRole, Team,
                    TeamCreate, TeamJoin, TeamResponse, TeamMember, AssignRole,
                    TeamStatus, TeamMemberRole, Competition, CompetitionCreate,
                    CompetitionResponse, CompetitionStatus)

# =========================================================
# MODELS
# =========================================================


class CFOApplicationCreate(BaseModel):
    experience_years: int
    job_title: str
    company: str


# =========================================================
# ROUTER SETUP
# =========================================================

security = HTTPBearer()
router = APIRouter(prefix="/api/cfo", tags=["CFO Competition"])

# =========================================================
# AUTH
# =========================================================


@router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password
        })

        if not auth_response or not auth_response.user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Failed to create user account")

        user_id = auth_response.user.id
        now = datetime.utcnow().isoformat()

        profile_data = {
            "id": user_id,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "role": user_data.role.value,
            "created_at": now,
            "updated_at": now
        }

        profile_response = supabase.table("user_profiles").insert(profile_data).execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create user profile"
            )

        return UserResponse(id=user_id,
                            email=user_data.email,
                            full_name=user_data.full_name,
                            role=user_data.role,
                            created_at=datetime.fromisoformat(now))

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        logger.error(f"Registration error for {user_data.email}: {e}")
        
        if "already registered" in error_str or "already exists" in error_str or "422" in error_str:
            raise HTTPException(status_code=400,
                                detail="Email already registered. Please try logging in instead.")
        if "password" in error_str:
            raise HTTPException(status_code=400,
                                detail="Password does not meet requirements. Must be at least 6 characters.")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/auth/login")
async def login(user_credentials: UserLogin):
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user_credentials.email,
            "password": user_credentials.password
        })
    except Exception as e:
        logger.error(f"Login auth error: {e}")
        raise HTTPException(status_code=401,
                            detail="Incorrect email or password")

    if not auth_response or not auth_response.session or not auth_response.user:
        raise HTTPException(status_code=401,
                            detail="Incorrect email or password")

    user_id = auth_response.user.id
    user_email = auth_response.user.email or user_credentials.email

    try:
        profile_result = supabase.table("user_profiles") \
            .select("*") \
            .eq("id", user_id) \
            .execute()
        
        profile_data = profile_result.data[0] if profile_result.data else None
    except Exception as e:
        logger.error(f"Profile fetch error: {e}")
        profile_data = None

    if not profile_data:
        logger.info(f"Creating missing profile for user {user_id}")
        now = datetime.utcnow().isoformat()
        new_profile = {
            "id": user_id,
            "email": user_email,
            "full_name": user_email.split("@")[0],
            "role": "participant",
            "created_at": now,
            "updated_at": now
        }
        try:
            insert_result = supabase.table("user_profiles").insert(new_profile).execute()
            profile_data = insert_result.data[0] if insert_result.data else new_profile
        except Exception as e:
            logger.error(f"Failed to create profile: {e}")
            raise HTTPException(status_code=500, detail="Failed to create user profile")

    if not profile_data:
        raise HTTPException(status_code=401, detail="User profile not found")

    return {
        "access_token": auth_response.session.access_token,
        "token_type": "bearer",
        "user": UserResponse(
            id=profile_data["id"],
            email=profile_data["email"],
            full_name=profile_data["full_name"],
            role=UserRole(profile_data["role"]),
            created_at=datetime.fromisoformat(profile_data["created_at"])
        )
    }


@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# =========================================================
# CFO APPLICATION
# =========================================================


@router.post("/applications", status_code=201)
async def apply_for_cfo(
        data: CFOApplicationCreate,
        current_user: User = Depends(get_current_user),
):
    supabase = get_supabase_client()

    existing = supabase.table("cfo_applications") \
        .select("id") \
        .eq("user_id", current_user.id) \
        .execute()

    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted a CFO application")

    insert_data = {
        "user_id": current_user.id,
        "experience_years": data.experience_years,
        "job_title": data.job_title,
        "company": data.company,
        "status": "pending",
        "applied_at": datetime.utcnow().isoformat()
    }

    result = supabase.table("cfo_applications").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500,
                            detail="Failed to submit application")

    return {
        "message": "CFO application submitted successfully",
        "application_id": result.data[0]["id"]
    }


# =========================================================
# COMPETITIONS
# =========================================================


@router.get("/competitions")
async def list_competitions():
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    response = supabase.table("competitions").select("*").order("created_at", desc=True).execute()
    
    competitions = response.data or []
    
    # Map backend status to frontend expected status
    # Backend uses: 'draft', 'open', 'closed'
    # Frontend expects: 'draft', 'registration_open', 'in_progress', 'completed'
    status_map = {
        'open': 'registration_open',
        'draft': 'draft',
        'closed': 'completed'
    }
    
    for comp in competitions:
        original_status = comp.get('status', 'draft')
        comp['status'] = status_map.get(original_status, original_status)
        
        # Ensure registered_teams field exists (frontend expects it)
        if 'registered_teams' not in comp:
            # Count actual teams for this competition
            teams_count = supabase.table("teams").select("id", count="exact").eq("competition_id", comp["id"]).execute()
            comp['registered_teams'] = teams_count.count if hasattr(teams_count, 'count') else 0
    
    logger.info(f"Returning {len(competitions)} competitions")
    return competitions


@router.get("/competitions/{competition_id}")
async def get_competition(competition_id: str):
    supabase = get_supabase_client()
    response = supabase.table("competitions").select("*").eq("id", competition_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    return response.data[0]


@router.post("/competitions")
async def create_competition(competition_data: CompetitionCreate,
                             admin_user: User = Depends(get_admin_user)):
    supabase = get_supabase_client()

    competition_dict = {
        "title": competition_data.title,
        "description": competition_data.description or "",
        "registration_start": competition_data.registration_start,
        "registration_end": competition_data.registration_end,
        "competition_start": competition_data.competition_start,
        "competition_end": competition_data.competition_end,
        "max_teams": competition_data.max_teams,
        "status": competition_data.status if competition_data.status in ["draft", "open", "closed"] else "draft"
    }

    response = supabase.table("competitions").insert(competition_dict).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create competition")

    return response.data[0]


# =========================================================
# COMPETITION REGISTRATION
# =========================================================


@router.get("/competitions/{competition_id}/is-registered")
async def check_registration(
    competition_id: str,
    current_user: User = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    response = supabase.table("competitions").select("id").eq("id", competition_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    registration = supabase.table("competition_registrations") \
        .select("id") \
        .eq("competition_id", competition_id) \
        .eq("user_id", current_user.id) \
        .execute()
    
    is_registered = bool(registration.data)
    logger.info(f"Registration check - user_id: {current_user.id}, competition_id: {competition_id}, is_registered: {is_registered}, registrations_found: {len(registration.data or [])}")
    
    return {"is_registered": is_registered}


@router.post("/competitions/{competition_id}/register", status_code=201)
async def register_for_competition(
    competition_id: str,
    current_user: User = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    competition = supabase.table("competitions").select("*").eq("id", competition_id).execute()
    if not competition.data:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    comp = competition.data[0]
    
    if comp.get("status") != "open":
        raise HTTPException(
            status_code=403, 
            detail="Registration is not open for this competition"
        )
    
    existing = supabase.table("competition_registrations") \
        .select("id") \
        .eq("competition_id", competition_id) \
        .eq("user_id", current_user.id) \
        .execute()
    
    if existing.data:
        raise HTTPException(
            status_code=409, 
            detail="You are already registered for this competition"
        )
    
    registration_data = {
        "competition_id": competition_id,
        "user_id": current_user.id
    }
    
    try:
        result = supabase.table("competition_registrations").insert(registration_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to register for competition")
        
        logger.info(f"User {current_user.id} registered for competition {competition_id}")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")



# =========================================================
# TEAMS
# =========================================================


@router.post("/teams")
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new team for a competition using atomic RPC."""
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    # Check if user is registered for the competition
    registration = supabase.table("competition_registrations") \
        .select("id") \
        .eq("competition_id", team_data.competition_id) \
        .eq("user_id", current_user.id) \
        .execute()
    
    if not registration.data:
        raise HTTPException(
            status_code=403,
            detail="You must be registered for this competition to create a team"
        )
    
    # Check if user is already in a team for this competition
    existing_membership = supabase.table("team_members") \
        .select("team_id, teams(competition_id)") \
        .eq("user_id", current_user.id) \
        .execute()
    
    for membership in existing_membership.data or []:
        team_info = membership.get("teams")
        if team_info and team_info.get("competition_id") == team_data.competition_id:
            raise HTTPException(
                status_code=400,
                detail="You are already in a team for this competition"
            )
    
    # Create team atomically using RPC (single transaction)
    # If either teams or team_members insert fails, entire operation rolls back
    try:
        result = supabase.rpc(
            "create_team_with_leader",
            {
                "p_team_name": team_data.team_name,
                "p_competition_id": team_data.competition_id,
                "p_user_id": current_user.id,
                "p_user_name": current_user.full_name
            }
        ).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create team")
        
        logger.info(f"Team created atomically for user {current_user.id}")
        
        return result.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Team creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create team: {str(e)}")


@router.get("/teams/my-team")
async def get_my_team(current_user: User = Depends(get_current_user)):
    """Get the current user's team."""
    supabase = get_supabase_client()
    
    # Find team membership for current user
    membership = supabase.table("team_members") \
        .select("team_id") \
        .eq("user_id", current_user.id) \
        .execute()
    
    if not membership.data:
        raise HTTPException(status_code=404, detail="You are not in any team")
    
    team_id = membership.data[0]["team_id"]
    
    # Get team details
    team_result = supabase.table("teams") \
        .select("*") \
        .eq("id", team_id) \
        .execute()
    
    if not team_result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = team_result.data[0]
    
    # Get team members
    members_result = supabase.table("team_members") \
        .select("*") \
        .eq("team_id", team_id) \
        .execute()
    
    team["members"] = members_result.data or []
    team["max_members"] = 5  # Constant max team size for frontend
    # Compute status from member count (no status column in DB)
    team["status"] = "complete" if len(team["members"]) >= 5 else "forming"
    
    return team


@router.get("/teams/competition/{competition_id}")
async def get_teams_by_competition(
    competition_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all teams for a competition."""
    supabase = get_supabase_client()
    
    # Get all teams for this competition
    teams_result = supabase.table("teams") \
        .select("*") \
        .eq("competition_id", competition_id) \
        .execute()
    
    teams = teams_result.data or []
    
    # Get members for each team and add computed fields
    for team in teams:
        members_result = supabase.table("team_members") \
            .select("*") \
            .eq("team_id", team["id"]) \
            .execute()
        team["members"] = members_result.data or []
        team["max_members"] = 5  # Constant max team size for frontend
        # Compute status from member count (no status column in DB)
        team["status"] = "complete" if len(team["members"]) >= 5 else "forming"
    
    return teams


@router.post("/teams/join")
async def join_team(
    join_data: TeamJoin,
    current_user: User = Depends(get_current_user)
):
    """Join an existing team."""
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    # Get team details
    team_result = supabase.table("teams") \
        .select("*") \
        .eq("id", join_data.team_id) \
        .execute()
    
    if not team_result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = team_result.data[0]
    
    # Check if user is registered for the competition
    registration = supabase.table("competition_registrations") \
        .select("id") \
        .eq("competition_id", team["competition_id"]) \
        .eq("user_id", current_user.id) \
        .execute()
    
    if not registration.data:
        raise HTTPException(
            status_code=403,
            detail="You must be registered for this competition to join a team"
        )
    
    # Check if user is already in a team for this competition
    existing_membership = supabase.table("team_members") \
        .select("team_id, teams(competition_id)") \
        .eq("user_id", current_user.id) \
        .execute()
    
    for membership in existing_membership.data or []:
        team_info = membership.get("teams")
        if team_info and team_info.get("competition_id") == team["competition_id"]:
            raise HTTPException(
                status_code=400,
                detail="You are already in a team for this competition"
            )
    
    # Get current member count
    MAX_TEAM_SIZE = 5  # Constant max team size
    members_result = supabase.table("team_members") \
        .select("id") \
        .eq("team_id", join_data.team_id) \
        .execute()
    
    current_members = len(members_result.data or [])
    
    if current_members >= MAX_TEAM_SIZE:
        raise HTTPException(status_code=400, detail="Team is full")
    
    # Add user to team
    now = datetime.utcnow().isoformat()
    member_dict = {
        "team_id": join_data.team_id,
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "joined_at": now
    }
    
    try:
        supabase.table("team_members").insert(member_dict).execute()
        
        # Team is implicitly complete when member count reaches MAX_TEAM_SIZE
        # No status update needed - frontend calculates from member count
        
        logger.info(f"User {current_user.id} joined team {join_data.team_id}")
        
        return {"success": True, "message": "Successfully joined team"}
        
    except Exception as e:
        logger.error(f"Join team error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to join team: {str(e)}")


@router.get("/teams/{team_id}")
async def get_team(
    team_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get team details by ID."""
    supabase = get_supabase_client()
    
    # Get team
    team_result = supabase.table("teams") \
        .select("*") \
        .eq("id", team_id) \
        .execute()
    
    if not team_result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = team_result.data[0]
    
    # Get team members
    members_result = supabase.table("team_members") \
        .select("*") \
        .eq("team_id", team_id) \
        .execute()
    
    team["members"] = members_result.data or []
    team["max_members"] = 5  # Constant max team size for frontend
    # Compute status from member count (no status column in DB)
    team["status"] = "complete" if len(team["members"]) >= 5 else "forming"
    
    return team


@router.delete("/teams/{team_id}/leave")
async def leave_team(
    team_id: str,
    current_user: User = Depends(get_current_user)
):
    """Leave a team."""
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    # Get team
    team_result = supabase.table("teams") \
        .select("*") \
        .eq("id", team_id) \
        .execute()
    
    if not team_result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = team_result.data[0]
    
    # Check if user is the leader
    if team["leader_id"] == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Team leaders cannot leave. Transfer leadership or delete the team."
        )
    
    # Check if user is a member
    membership = supabase.table("team_members") \
        .select("id") \
        .eq("team_id", team_id) \
        .eq("user_id", current_user.id) \
        .execute()
    
    if not membership.data:
        raise HTTPException(status_code=400, detail="You are not a member of this team")
    
    # Remove user from team
    try:
        supabase.table("team_members") \
            .delete() \
            .eq("team_id", team_id) \
            .eq("user_id", current_user.id) \
            .execute()
        
        # No status update needed - team completeness is calculated from member count
        
        logger.info(f"User {current_user.id} left team {team_id}")
        
        return {"success": True, "message": "Successfully left team"}
        
    except Exception as e:
        logger.error(f"Leave team error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to leave team: {str(e)}")


@router.put("/teams/{team_id}/assign-role")
async def assign_role(
    team_id: str,
    role_data: AssignRole,
    current_user: User = Depends(get_current_user)
):
    """Assign a role to a team member (leader only)."""
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    # Get team
    team_result = supabase.table("teams") \
        .select("*") \
        .eq("id", team_id) \
        .execute()
    
    if not team_result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = team_result.data[0]
    
    # Check if current user is the leader
    if team["leader_id"] != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the team leader can assign roles"
        )
    
    # Check if target user is a team member
    membership = supabase.table("team_members") \
        .select("id") \
        .eq("team_id", team_id) \
        .eq("user_id", role_data.user_id) \
        .execute()
    
    if not membership.data:
        raise HTTPException(status_code=400, detail="User is not a member of this team")
    
    # Check if role is already assigned to another member
    existing_role = supabase.table("team_members") \
        .select("user_id") \
        .eq("team_id", team_id) \
        .eq("team_role", role_data.team_role.value) \
        .execute()
    
    if existing_role.data:
        for member in existing_role.data:
            if member["user_id"] != role_data.user_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Role '{role_data.team_role.value}' is already assigned to another member"
                )
    
    # Update the role
    try:
        supabase.table("team_members").update({
            "team_role": role_data.team_role.value
        }).eq("team_id", team_id).eq("user_id", role_data.user_id).execute()
        
        logger.info(f"Role {role_data.team_role.value} assigned to user {role_data.user_id} in team {team_id}")
        
        return {"success": True, "message": "Role assigned successfully"}
        
    except Exception as e:
        logger.error(f"Assign role error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to assign role: {str(e)}")
