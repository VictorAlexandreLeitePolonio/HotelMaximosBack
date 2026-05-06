using HotelMaximos.Api.Shared.Api;

namespace HotelMaximos.Api.Tests.Shared.Api;

public sealed class ApiContractsTests
{
    [Fact]
    public void Unexpected_error_uses_stable_error_number_and_trace_id()
    {
        var response = ApiErrorResponse.Unexpected("trace-123");

        Assert.Equal("UNEXPECTED_ERROR", response.ErrorNumber);
        Assert.Equal("trace-123", response.TraceId);
        Assert.False(string.IsNullOrWhiteSpace(response.Message));
        Assert.False(string.IsNullOrWhiteSpace(response.Details));
    }

    [Fact]
    public void Paginated_response_preserves_pagination_metadata()
    {
        var response = new PaginatedResponse<string>(
            ["item-a", "item-b"],
            Page: 2,
            PageSize: 10,
            TotalCount: 25,
            TotalPages: 3);

        Assert.Equal(2, response.Data.Count);
        Assert.Equal(2, response.Page);
        Assert.Equal(10, response.PageSize);
        Assert.Equal(25, response.TotalCount);
        Assert.Equal(3, response.TotalPages);
    }
}
