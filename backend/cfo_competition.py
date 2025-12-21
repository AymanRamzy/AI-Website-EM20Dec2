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


@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()

    # Email normalization (MANDATORY)
    normalized_email = user_data.email.strip().lower()

    try:
        # Step 1: Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": normalized_email,
            "password": user_data.password
        })

        if not auth_response or not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )

        user_id = auth_response.user.id
        now = datetime.utcnow().isoformat()

        # Step 2: Check if profile was auto-created by trigger
        existing_profile = supabase.table("user_profiles")\
            .select("id")\
            .eq("id", user_id)\
            .execute()

        if existing_profile.data:
            # Profile exists (created by trigger), update it with full details
            logger.info(f"Updating auto-created profile for user {user_id}")
            supabase.table("user_profiles").update({
                "email": normalized_email,
                "full_name": user_data.full_name,
                "role": user_data.role.value,
                "updated_at": now
            }).eq("id", user_id).execute()
        else:
            # No trigger, create profile manually
            logger.info(f"Creating new profile for user {user_id}")
            profile_data = {
                "id": user_id,
                "email": normalized_email,
                "full_name": user_data.full_name,
                "role": user_data.role.value,
                "created_at": now,
                "updated_at": now
            }
            supabase.table("user_profiles").insert(profile_data).execute()

        logger.info(f"Registration successful for {normalized_email}")
        
        return UserResponse(
            id=user_id,
            email=normalized_email,
            full_name=user_data.full_name,
            role=user_data.role,
            created_at=datetime.fromisoformat(now)
        )

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        logger.error(f"Registration error for {normalized_email}: {e}")
        
        # 409 for duplicate email
        if "already registered" in error_str or "user already registered" in error_str:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered. Please try logging in instead."
            )
        # Password requirements
        if "password" in error_str and ("weak" in error_str or "short" in error_str or "6" in error_str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters."
            )
        # Rate limiting
        if "security purposes" in error_str or "after" in error_str and "seconds" in error_str:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a moment and try again."
            )
        # Generic server error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/auth/login")
async def login(user_credentials: UserLogin):
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()

    # Email normalization (MANDATORY)
    normalized_email = user_credentials.email.strip().lower()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": normalized_email,
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
    user_email = auth_response.user.email or normalized_email

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
# CFO APPLICATION - Leadership Application System (CFO-FIRST MODEL)
# =========================================================
# Phase 1: Individual CFO applications (NO team requirements)
# Phase 2: Only Qualified CFOs (Top 100) can create teams

from cfo_application_scoring import (
    CFOFullApplication, calculate_total_score, determine_status,
    CFOApplicationStep1, CFOApplicationStep2, CFOApplicationStep3, CFOApplicationStep4
)


@router.get("/applications/eligibility")
async def check_cfo_eligibility(
    competition_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Check if user is eligible to apply as CFO.
    CFO-FIRST MODEL: No team requirements - individuals apply first.
    """
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    eligibility = {
        "eligible": False,
        "reasons": [],
        "checks": {
            "authenticated": True,
            "applications_open": False,
            "not_already_applied": True
        }
    }
    
    # Check competition exists
    comp_result = supabase.table("competitions").select("*").eq("id", competition_id).execute()
    if not comp_result.data:
        eligibility["reasons"].append("Competition not found")
        return eligibility
    
    competition = comp_result.data[0]
    
    # Check if applications are open
    if competition.get("status") in ["applications_open", "open"]:
        eligibility["checks"]["applications_open"] = True
    else:
        eligibility["reasons"].append("CFO applications are not currently open")
    
    # Check if already applied
    existing_app = supabase.table("cfo_applications")\
        .select("id, status")\
        .eq("user_id", current_user.id)\
        .eq("competition_id", competition_id)\
        .execute()
    
    if existing_app.data:
        eligibility["checks"]["not_already_applied"] = False
        app_status = existing_app.data[0].get("status", "pending")
        eligibility["existing_application"] = {
            "id": existing_app.data[0]["id"],
            "status": app_status
        }
        eligibility["reasons"].append(f"You have already applied (Status: {app_status})")
    
    # Determine final eligibility
    all_checks_passed = all(eligibility["checks"].values())
    eligibility["eligible"] = all_checks_passed
    
    if all_checks_passed:
        eligibility["reasons"] = ["You are eligible to apply as CFO"]
    
    logger.info(f"CFO eligibility check for user {current_user.id}: eligible={eligibility['eligible']}")
    
    return eligibility


@router.post("/applications/submit", status_code=201)
async def submit_cfo_application(
    application: CFOFullApplication,
    current_user: User = Depends(get_current_user)
):
    """Submit full CFO leadership application (CFO-FIRST: No team required)"""
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    # Verify eligibility first
    eligibility_check = await check_cfo_eligibility(application.competition_id, current_user)
    if not eligibility_check["eligible"]:
        raise HTTPException(
            status_code=403,
            detail=f"Not eligible to apply: {', '.join(eligibility_check['reasons'])}"
        )
    
    # Calculate score
    score_result = calculate_total_score(application)
    
    # Prepare application data for storage
    app_data = {
        "user_id": current_user.id,
        "competition_id": application.competition_id,
        # Step 1
        "experience_years": application.step1.experience_years.value,
        "leadership_exposure": application.step1.leadership_exposure.value,
        "decision_ownership": application.step1.decision_ownership.value,
        "leadership_willingness": application.step1.leadership_willingness.value,
        "commitment_level": application.step1.commitment_level.value,
        # Step 2
        "capital_allocation": application.step2.capital_allocation.value,
        "capital_justification": application.step2.capital_justification,
        "cash_vs_profit": application.step2.cash_vs_profit,
        "kpi_prioritization": application.step2.kpi_prioritization,
        # Step 3
        "dscr_choice": application.step3.dscr_choice.value,
        "dscr_impact": application.step3.dscr_impact,
        "cost_priority": application.step3.cost_priority.value,
        "cfo_mindset": application.step3.cfo_mindset.value,
        "mindset_explanation": application.step3.mindset_explanation,
        # Step 4
        "ethics_choice": application.step4.ethics_choice.value,
        "culture_vs_results": application.step4.culture_vs_results.value,
        "why_top_100": application.step4.why_top_100,
        # Scoring (internal only)
        "total_score": score_result["final_score"],
        "raw_score": score_result["total_raw_score"],
        "leadership_score": score_result["section_scores"]["leadership"],
        "ethics_score": score_result["section_scores"]["ethics"],
        "capital_score": score_result["section_scores"]["capital_allocation"],
        "judgment_score": score_result["section_scores"]["financial_judgment"],
        "red_flag_count": score_result["red_flag_count"],
        "red_flags": score_result["red_flags"],
        "auto_excluded": score_result["auto_exclude"],
        "exclusion_reason": score_result["exclusion_reason"],
        # Status
        "status": "excluded" if score_result["auto_exclude"] else "pending",
        "submitted_at": datetime.utcnow().isoformat()
    }
    
    try:
        result = supabase.table("cfo_applications").insert(app_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to submit application")
        
        logger.info(f"CFO application submitted by user {current_user.id}, score: {score_result['final_score']}, excluded: {score_result['auto_exclude']}")
        
        # Return success without revealing score
        return {
            "success": True,
            "message": "Your CFO leadership application has been submitted successfully.",
            "application_id": result.data[0]["id"],
            "status": "under_review"
        }
        
    except Exception as e:
        logger.error(f"CFO application error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit application: {str(e)}")


@router.get("/applications/my-application")
async def get_my_cfo_application(
    competition_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current user's CFO application status (without revealing score)"""
    supabase = get_supabase_client()
    
    result = supabase.table("cfo_applications")\
        .select("id, status, submitted_at")\
        .eq("user_id", current_user.id)\
        .eq("competition_id", competition_id)\
        .execute()
    
    if not result.data:
        return {"has_applied": False}
    
    app = result.data[0]
    
    # Map internal status to user-friendly status
    status_map = {
        "pending": "Under Review",
        "qualified": "Qualified - Top 100",
        "reserve": "Reserve List",
        "not_selected": "Not Selected",
        "excluded": "Not Eligible"
    }
    
    return {
        "has_applied": True,
        "application_id": app["id"],
        "status": status_map.get(app["status"], "Under Review"),
        "submitted_at": app["submitted_at"]
    }


@router.get("/applications/admin/list")
async def admin_list_applications(
    competition_id: str,
    current_user: User = Depends(get_admin_user)
):
    """Admin: List all applications with scores and rankings"""
    supabase = get_supabase_client()
    
    result = supabase.table("cfo_applications")\
        .select("*, user_profiles(full_name, email)")\
        .eq("competition_id", competition_id)\
        .order("total_score", desc=True)\
        .execute()
    
    applications = result.data or []
    
    # Add ranking
    for i, app in enumerate(applications):
        if not app.get("auto_excluded"):
            app["rank"] = i + 1
            app["final_status"] = determine_status(i + 1, app.get("auto_excluded", False))
        else:
            app["rank"] = None
            app["final_status"] = "excluded"
    
    return {
        "total_applications": len(applications),
        "qualified_count": len([a for a in applications if a["final_status"] == "qualified"]),
        "reserve_count": len([a for a in applications if a["final_status"] == "reserve"]),
        "excluded_count": len([a for a in applications if a["final_status"] == "excluded"]),
        "applications": applications
    }


@router.put("/applications/admin/{application_id}/override")
async def admin_override_status(
    application_id: str,
    new_status: str,
    reason: str,
    current_user: User = Depends(get_admin_user)
):
    """Admin: Manual override of application status (rare cases)"""
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    valid_statuses = ["qualified", "reserve", "not_selected", "excluded"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = supabase.table("cfo_applications")\
        .update({
            "status": new_status,
            "admin_override": True,
            "override_reason": reason,
            "override_by": current_user.id,
            "override_at": datetime.utcnow().isoformat()
        })\
        .eq("id", application_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found")
    
    logger.info(f"Admin {current_user.id} overrode application {application_id} to status {new_status}")
    
    return {"success": True, "message": f"Application status updated to {new_status}"}


# Legacy endpoint - keep for backward compatibility
@router.post("/applications", status_code=201)
async def apply_for_cfo_legacy(
        data: CFOApplicationCreate,
        current_user: User = Depends(get_current_user),
):
    """Legacy CFO application endpoint"""
    raise HTTPException(
        status_code=400,
        detail="Please use the new CFO application form at /applications/submit"
    )


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
# TEAMS (CFO-FIRST: Only Qualified CFOs can create teams)
# =========================================================


@router.post("/teams")
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new team for a competition.
    CFO-FIRST MODEL: Only users with qualified CFO status can create teams.
    """
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_supabase_client()
    
    # CFO-FIRST: Check if user is a QUALIFIED CFO for this competition
    cfo_app = supabase.table("cfo_applications") \
        .select("id, status") \
        .eq("competition_id", team_data.competition_id) \
        .eq("user_id", current_user.id) \
        .execute()
    
    if not cfo_app.data:
        raise HTTPException(
            status_code=403,
            detail="You must apply as CFO first before creating a team"
        )
    
    app_status = cfo_app.data[0].get("status")
    if app_status != "qualified":
        status_messages = {
            "pending": "Your CFO application is still under review",
            "reserve": "You are on the reserve list (Top 101-150). Only Top 100 CFOs can create teams",
            "not_selected": "Your CFO application was not selected",
            "excluded": "Your CFO application was not eligible"
        }
        raise HTTPException(
            status_code=403,
            detail=status_messages.get(app_status, "Only qualified CFOs (Top 100) can create teams")
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
    
    # Create team - database trigger automatically adds leader to team_members
    try:
        # Step 1: Insert into teams table (trigger creates team_member with team_role='leader')
        team_result = supabase.table("teams").insert({
            "team_name": team_data.team_name,
            "competition_id": team_data.competition_id,
            "leader_id": current_user.id
        }).execute()
        
        if not team_result.data:
            raise HTTPException(status_code=500, detail="Failed to create team")
        
        team = team_result.data[0]
        team_id = team["id"]
        
        # Step 2: Update the auto-created team_member with user_name
        supabase.table("team_members").update({
            "user_name": current_user.full_name
        }).eq("team_id", team_id).eq("user_id", current_user.id).execute()
        
        logger.info(f"Team created by qualified CFO {current_user.id}")
        
        return team
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Team creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create team: {str(e)}")


@router.get("/teams/eligibility")
async def check_team_creation_eligibility(
    competition_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Check if user can create a team (CFO-FIRST model).
    Only qualified CFOs (Top 100) can create teams.
    """
    supabase = get_supabase_client()
    
    eligibility = {
        "can_create_team": False,
        "reason": "",
        "cfo_status": None,
        "has_team": False
    }
    
    # Check CFO application status
    cfo_app = supabase.table("cfo_applications") \
        .select("id, status") \
        .eq("competition_id", competition_id) \
        .eq("user_id", current_user.id) \
        .execute()
    
    if not cfo_app.data:
        eligibility["reason"] = "You must apply as CFO first"
        return eligibility
    
    app_status = cfo_app.data[0].get("status")
    eligibility["cfo_status"] = app_status
    
    if app_status != "qualified":
        status_reasons = {
            "pending": "Your CFO application is under review",
            "reserve": "You are on the reserve list (101-150)",
            "not_selected": "Your application was not selected",
            "excluded": "Your application was not eligible"
        }
        eligibility["reason"] = status_reasons.get(app_status, "Only qualified CFOs can create teams")
        return eligibility
    
    # Check if already in a team
    existing = supabase.table("team_members") \
        .select("team_id, teams(competition_id)") \
        .eq("user_id", current_user.id) \
        .execute()
    
    for membership in existing.data or []:
        team_info = membership.get("teams")
        if team_info and team_info.get("competition_id") == competition_id:
            eligibility["has_team"] = True
            eligibility["reason"] = "You already have a team for this competition"
            return eligibility
    
    eligibility["can_create_team"] = True
    eligibility["reason"] = "You are a qualified CFO - you can create a team!"
    
    return eligibility


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
