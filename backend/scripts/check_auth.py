import asyncio
from app.core.database import AsyncSessionLocal
from app.modules.auth.service import AuthService
from redis.asyncio import Redis

async def main():
    async with AsyncSessionLocal() as session:
        redis = Redis(host="localhost", port=6379)
        auth = AuthService(session, redis)
        try:
            user = await auth.authenticate("reception@medicare.com", "Reception@123")
            print("Successfully authenticated:", user.email, user.full_name, user.role.name)
            tokens = await auth.generate_tokens(user)
            print("Generated tokens:", tokens.keys())
        except Exception as e:
            print("Auth failed with:", type(e), e)
        finally:
            await redis.aclose()

if __name__ == "__main__":
    asyncio.run(main())
