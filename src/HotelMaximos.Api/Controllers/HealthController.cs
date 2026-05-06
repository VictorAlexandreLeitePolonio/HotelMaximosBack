using HotelMaximos.Api.Shared.Api;
using Microsoft.AspNetCore.Mvc;

namespace HotelMaximos.Api.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
    {
        return Ok(new HealthResponse("Healthy", DateTimeOffset.UtcNow));
    }
}
